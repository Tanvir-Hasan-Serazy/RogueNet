## Context

Greenfield social platform (roguenet) with no existing code. See proposal.md Why for motivation. Authentication is fixed to **better-auth** per user decision — all auth, session, and route protection must use better-auth and its adapter, not a custom JWT/session layer. The rest of the system (profiles, posts, feed, search, real-time) builds atop the better-auth user identity.

## Goals / Non-Goals

**Goals:**

- Integrate better-auth as the sole auth source of truth with Prisma or Drizzle adapter, cookie-based sessions, email/password + verification, and optional OAuth, reused for both HTTP and WebSocket auth.
- Deliver phased social product (identity -> content -> engagement -> distribution -> real-time) without schema-breaking migrations, with better-auth user as FK root for all social tables.
- Data model that supports visibility (public/followers_only/private) and soft-delete inheritance for reposts on day one.
- Hybrid fan-out (push to presence-tracked active users, pull for offline), viewer-specific EdgeRank feed ordering (affinity × edge weight × time decay), and correct pagination (opaque ranked cursor for feed, offset for search).
- Search via Postgres FTS initially, pluggable to Typesense/Meilisearch later.
- Single multiplexed authenticated WebSocket tied to better-auth session for presence, messaging, typing, live comments/notifications.

**Non-Goals:**

- Custom auth, manual password hashing, or parallel session tables outside better-auth.
- Learned recommendation ML / a separate algorithmic "For You" feed beyond the deterministic EdgeRank model (affinity × edge weight × time decay, with downvote demotion).
- E2E encryption for messaging.
- Video transcoding beyond Cloudinary.
- Multi-region / edge replication, native mobile push (FCM/APNs).

## Decisions

### 1. Auth: Better Auth with Prisma 7 Adapter (Decision from User)

**Chosen:** `better-auth` with the Prisma adapter on Prisma 7. Configure email/password, cookie sessions, and Google/GitHub OAuth in the Express backend. Better Auth owns the `user`, `session`, `account`, and `verification` tables; the app extends `user` with optional `username` and `dob` fields through `additionalFields`. The Express handler is mounted at `/api/auth/*`; the Next.js client calls the same API with credentials enabled. Protected routes use `auth.api.getSession`, and WebSocket handshakes validate the Better Auth session cookie.
**Alternatives considered:** NextAuth/Auth.js — more Next.js-specific, less flexible adapter model; custom JWT — hides nothing but reimplements what better-auth already solves and was explicitly not requested; Supabase Auth — managed, hides hard problems, couples to Supabase.
**Rationale:** User explicitly chose better-auth; it provides the best learning surface for modern auth (adapters, plugins, session vs JWT, OAuth, verification) while removing undifferentiated auth boilerplate.

### 2. Stack: Express + Next.js + Prisma 7 + Postgres + Redis + Cloudinary + WebSockets

**Chosen:** Express serves the Better Auth Node handler and the future REST API; Next.js provides the frontend. Prisma 7 with `@prisma/adapter-pg` is the ORM and Postgres is the source of truth. Redis handles presence/pub-sub, Cloudinary handles signed direct uploads, and BullMQ or pg-boss handles notification batching.
**Alternative:** Move the Better Auth handler into Next.js later if the API is consolidated; the Better Auth contract and database tables remain unchanged.
**Rationale:** This matches the current repository layout while retaining Better Auth's standard session and adapter behavior.

### 3. Data Model: better-auth User as Root + Social Tables

**Chosen:**

```
// managed by better-auth (via Prisma 7 adapter)
user(id, email, emailVerified, name, firstName, lastName, image, createdAt, updatedAt, username unique nullable, dob nullable)
session(id, userId FK, token, expiresAt, ipAddress, userAgent, ...)
account(id, userId FK, providerId, accountId, ...)
verification(id, identifier, value, expiresAt, ...)

// app-owned
follows(followerId FK user.id, followingId FK user.id, createdAt) PK(followerId,followingId)
posts(id, authorId FK user.id, body, visibility enum('public','followers_only','private'), mediaUrls jsonb, deletedAt nullable, createdAt, tsv)
reposts(id, userId FK user.id, originalPostId FK posts.id, createdAt) unique(userId, originalPostId)
replies(id, postId FK posts.id, authorId FK user.id, body, replyToUserId nullable FK user.id, createdAt)
votes(userId FK user.id, postId FK posts.id, value int +-1, createdAt) PK(userId,postId)
bookmarks(userId FK user.id, postId FK posts.id, createdAt) PK(userId,postId)
conversations(id, isGroup bool, name nullable, createdAt)
conversationParticipants(conversationId, userId FK user.id, role enum('admin','member'), joinedAt) PK(conv,user)
messages(id, conversationId FK, senderId FK user.id, body nullable, imageUrl nullable, createdAt)
messageReads(messageId, userId, readAt) PK(messageId,userId)
notifications(id, receiverId FK user.id, type enum('follow','like','repost','reply','message'), actorId FK user.id, targetId, aggregatedCount int default 1, isRead bool, createdAt)
```

All app tables FK to `user.id` from better-auth. Username uniqueness enforced via DB unique index on `user.username` (additionalField) or profile table unique. Soft delete via `deletedAt`; reposts hide when `original.deletedAt IS NOT NULL OR original.visibility='private' OR (original.visibility='followers_only' AND viewer not follower)`.
**Alternative:** Separate profile table vs extending better-auth user — both valid; extending via `additionalFields` keeps single user table, separate profile table keeps auth migration clean. Choose extended user with additionalFields for simplicity; can split later.

### 4. Auth Integration Pattern: Better-Auth Delegation + WS Handshake (no custom middleware)

**Chosen:**

- HTTP: App routes delegate to better-auth as sole authority via `auth.api.getSession({ headers })` — a thin helper (1-2 lines) that returns 401 when no session exists, not a custom auth system. No password/session logic outside better-auth. The Next.js client uses `authClient` for email sign-up/sign-in and Google/GitHub social sign-in.
- WebSocket: handshake reads better-auth session cookie (`better-auth.session_token` or configured cookie name) from `req.headers.cookie`, validates via `auth.api.getSession`, attaches `userId` to socket; unauthenticated sockets rejected. Single socket per user multiplexed for feed push, messaging, presence, typing, notifications.
- Authorization: after authentication, call central `canView(viewerId, post)` for visibility checks — decoupled from better-auth (auth proves who you are, `canView` proves what you can see).
  **Alternative:** JWT bearer for WS — viable but better-auth default is cookie session; staying cookie-aligned avoids dual auth modes. Custom middleware that re-implements session logic was rejected — better-auth handles it.

### 5. Visibility Enforcement: DB + Service Guard

**Chosen:** Central `canView(viewerId, post)` called on every read path (feed, search, profile, repost hydration). Enforced in SQL WHERE, not just app filtering. Index on `(authorId, visibility, createdAt)` and GIN on `tsvector`.
**Alternative:** RLS — deferred.

### 6. Feed Fan-out: Hybrid Push to Active + Pull for Offline

**Chosen:** Presence `SET presence:{userId} 1 EX 300` on WS connect + 30s heartbeat. On post create: fetch follower IDs, intersect with online set (Redis), push `new_post` via WS to online followers; offline served via pull `WHERE authorId IN (following+self) AND canView` on next feed request. Demonstrates both paths.
**Alternative:** Pure push (timeline tables) — storage heavy; pure pull — never teaches push.

### 7. Pagination: Opaque Ranked Cursor for Feed, Offset for Search

**Chosen:** Feed pagination uses an opaque cursor over the ranked position `(score DESC, id DESC)`. The cursor encodes the last returned score, post id, and a ranking snapshot token; the next page is `score < :cursorScore OR (score = :cursorScore AND id < :cursorId)` evaluated against that snapshot. Ranking snapshots (for example a short-lived Redis-ordered candidate list keyed by viewer and snapshot id, 5-minute TTL) keep page 1 and page 2 consistent when posts are inserted or engagement changes mid-scroll. Search keeps `LIMIT 20 OFFSET :page*20` with a max page cap of 100. Directly teaches offset drift (demo bug with two browsers, then fix) for search while the feed stays stable.
**Alternative:** Offset on the feed — duplicates/skips under inserts; id-only cursor — incompatible with ranked ordering; recomputing scores on every page — old posts can reappear or disappear at page boundaries.

### 8. Ranking: Viewer-Specific EdgeRank

**Chosen:** Rank the home feed with EdgeRank:

```
EdgeRank(viewer, post) = affinity(viewer, author) × edgeWeight(post) × timeDecay(post.createdAt) × quality(post, viewer)
```

- `affinity` in `[0.1, 1.0]`: self = 1.0, mutual follow = 1.0, viewer follows author = 0.85, author follows viewer = 0.6, no edge = 0.3, plus a capped bonus from recent interactions (votes, replies, reposts, bookmarks).
- `edgeWeight`: original post = 1.0, repost = 0.8, reply = 0.6; a richer edge such as one with media may add a small boost (e.g. +0.1).
- `timeDecay`: `0.5 ^ (ageHours / halfLifeHours)` with a configurable half-life, default 12 hours.
- `quality`: downvotes apply a demotion multiplier (e.g. `max(0.1, 1 - 0.5 × downRatio)`); upvotes may contribute to affinity or quality. Downvotes demote, never hide.

Weights and the half-life live in config so they can be tuned without code changes. Scoring is computed per request over the candidate set (followed authors + self) and cached as an ordered snapshot for cursor pagination; a materialized ranking-score column is deferred until the simple path is measured.
**Alternative:** Plain reverse-chronological — simple but ignores the social graph; Reddit/Wilson hot — still useful for a future "Top" tab, but not the default relationship-aware feed; pure downvote demotion + recency — the previous plan, replaced because it does not use the follow graph or edge type.

### 9. Search: Postgres FTS First, Pluggable

**Chosen:** Postgres `tsvector + GIN` for posts, `pg_trgm` for people prefix search. Toggle `Posts | People` maps to two queries behind `SearchService` interface.
**Alternative:** Elasticsearch from day one — heavier ops.

### 10. Media: Signed Direct Upload to Cloudinary

**Chosen:** Client requests signed params from `POST /api/media/sign` (protected by better-auth session), uploads directly to Cloudinary, sends `secure_url` in post/message create. API never proxies bytes.
**Alternative:** Proxy through server — doubles bandwidth.

### 11. Notifications: Buffered Aggregation

**Chosen:** Buffer key `notif:{type}:{targetId}:{receiverId}` with 5-min window in Redis/DB; worker (BullMQ/pg-boss) aggregates count, inserts single notification, live WS push `notification:new`. Unread count via `COUNT WHERE isRead=false`.
**Alternative:** Immediate per-event insert — spam.

### 12. Messaging: Unified Conversations Model

**Chosen:** Single `conversations` with `isGroup`, rooms `conversation:{id}` for WS fan-out, read receipts per user per message, typing ephemeral `typing:start/stop` with 3s timeout.
**Alternative:** Separate 1:1/group tables — duplication.

## Risks / Trade-offs

- [better-auth session vs WS auth] WS handshake must validate cookie session, not just trust client `userId` -> Mitigation: server validates `auth.api.getSession` on handshake, rejects unauthenticated sockets, re-validates on reconnect.
- [better-auth migration drift] better-auth adapter tables managed by better-auth CLI may conflict with Prisma `migrate` -> Mitigation: run `better-auth generate` or adapter `generate` and include output in Prisma migration; commit generated schema; test `prisma migrate dev` after better-auth update.
- [Username uniqueness on extended user] additionalFields may not create unique index automatically -> Mitigation: add explicit `@@unique([username])` in Prisma schema for the user model, handle 409 on conflict.
- [Presence TTL drift] Disconnect without close shows online up to 5 min -> Mitigation: short TTL 60-120s + heartbeat, show lastSeen fallback.
- [Fan-out thundering herd] 50k followers intersect + push -> Mitigation: push via queue in batches, cap MVP to small follower counts, document limit.
- [Visibility leakage via repost/search] -> Mitigation: central `canView`, integration tests assert non-follower cannot fetch via any path, including via repost ID.
- [Cursor pagination with ranking] Ranked ordering breaks an id-only cursor -> Mitigation: opaque `(score, id)` cursor bound to a short-lived ranking snapshot so inserts/engagement changes do not duplicate or skip rows; refresh starts a new snapshot.
- [Affinity changes mid-scroll] Follow/unfollow or interaction bonuses may reorder posts between pages -> Mitigation: freeze affinity and decay inputs inside the pagination snapshot; recompute only on a fresh feed load.
- [EdgeRank weight tuning] Hand-tuned affinity/weight constants can produce stale or repetitive feeds -> Mitigation: keep weights in config, start with a 12-hour half-life and follow-graph affinity, log score components, and tune from observed ranking quality before adding learned signals.
- [Offset deep pages slow] -> Mitigation: max page 100 cap, document cursor alternative.
- [Cloudinary quota] Unbounded uploads -> Mitigation: signed URL expiry, per-user rate limit, max size/mime validation, protected by better-auth session.
- [WS horizontal scale] User A on server 1, user B on server 2 cannot receive event -> Mitigation: Redis pub/sub adapter (Socket.io Redis adapter or custom), demo with 2 instances after single-instance works.
- [better-auth email verification blocking] Unverified user may still create posts if not gated -> Mitigation: decide policy (allow with `emailVerified` gate on write or not); spec requires authenticated session, optionally gate sensitive writes on `user.emailVerified`.

## Migration Plan

Greenfield — no migration. Deploy order:

1. Configure the Express Better Auth Node handler, Prisma 7 adapter, Next.js client, and environment variables; run `prisma generate` and `prisma migrate`, then verify sign-up/sign-in/session and a protected route -> deploy.
2. Add profile/social-graph/posts/replies/voting/bookmarks (HTTP only, `canView` guard using `session.user.id`) -> deploy, verify visibility.
3. Add Cloudinary signed uploads (protected by better-auth session), FTS search, EdgeRank feed with ranked cursor/snapshot pagination, notification batching worker -> deploy, verify ranking and pagination.
4. Add WS server + presence + live notifications/typing/comments (WS auth via better-auth session) -> single instance -> deploy.
5. Add messaging (1:1 then groups) + read receipts -> deploy, test offline delivery.
6. Scale: second WS instance + Redis adapter, queue fan-out.

Rollback: each phase behind feature flag/routes; DB columns nullable first; better-auth adapter changes are additive; no destructive migrations at MVP.

## Open Questions

- OAuth providers: which to enable at MVP (email/password alone is sufficient; adding GitHub/Google later is non-breaking via better-auth config). Default to email/password + verification at MVP.
- better-auth session strategy: cookie session (default) vs JWT — defer; default to cookie as better-auth's primary, more secure for Next.js.
- Group admin permissions (who can add/remove, rename) — defer to messaging phase 2; MVP any member can add, creator is admin.
- EdgeRank affinity/weight/half-life tuning and the future "Top" tab weights — defer until the deterministic EdgeRank feed works end to end.
