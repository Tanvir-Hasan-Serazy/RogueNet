## Context

Greenfield social platform (roguenet) with no existing code. See proposal.md Why for motivation. Authentication is fixed to **better-auth** per user decision — all auth, session, and route protection must use better-auth and its adapter, not a custom JWT/session layer. The rest of the system (profiles, posts, feed, search, real-time) builds atop the better-auth user identity.

## Goals / Non-Goals

**Goals:**
- Integrate better-auth as the sole auth source of truth with Prisma or Drizzle adapter, cookie-based sessions, email/password + verification, and optional OAuth, reused for both HTTP and WebSocket auth.
- Deliver phased social product (identity -> content -> engagement -> distribution -> real-time) without schema-breaking migrations, with better-auth user as FK root for all social tables.
- Data model that supports visibility (public/followers_only/private) and soft-delete inheritance for reposts on day one.
- Hybrid fan-out (push to presence-tracked active users, pull for offline) and correct pagination (cursor for feed, offset for search).
- Search via Postgres FTS initially, pluggable to Typesense/Meilisearch later.
- Single multiplexed authenticated WebSocket tied to better-auth session for presence, messaging, typing, live comments/notifications.

**Non-Goals:**
- Custom auth, manual password hashing, or parallel session tables outside better-auth.
- Recommendation ML / algorithmic For You feed beyond simple downvote demotion + recency.
- E2E encryption for messaging.
- Video transcoding beyond Cloudinary.
- Multi-region / edge replication, native mobile push (FCM/APNs).

## Decisions

### 1. Auth: better-auth with Prisma/Drizzle Adapter (Decision from User)
**Chosen:** `better-auth` as auth framework. Use Prisma adapter if Prisma is ORM, or Drizzle adapter if Drizzle is ORM — both are first-class. Configure with emailAndPassword (with email verification), session (cookie, httpOnly, sameSite lax, secure in prod), and optional OAuth providers (GitHub/Google). better-auth creates its own tables (`user`, `session`, `account`, `verification`) via migration; app extends `user` with social fields (username, displayName, bio, avatarUrl) via additionalFields or a linked `profile` table FK to `user.id`. All protected routes use `auth.api.getSession` (server) or `authClient.useSession` (client); WebSocket handshake validates better-auth session cookie/token.
**Alternatives considered:** NextAuth/Auth.js — more Next.js-specific, less flexible adapter model; custom JWT — hides nothing but reimplements what better-auth already solves and was explicitly not requested; Supabase Auth — managed, hides hard problems, couples to Supabase.
**Rationale:** User explicitly chose better-auth; it provides the best learning surface for modern auth (adapters, plugins, session vs JWT, OAuth, verification) while removing undifferentiated auth boilerplate.

### 2. Stack: Next.js App Router + Prisma + Postgres + Redis + Cloudinary + WebSockets
**Chosen:** Next.js App Router recommended (better-auth has first-class Next.js integration via `auth` handler at `app/api/auth/[...all]/route.ts`), Prisma as ORM (works cleanly with better-auth Prisma adapter), Postgres as source of truth, Redis for presence TTL + pub/sub, Cloudinary for media via signed direct upload, queue via BullMQ or pg-boss for notification batching. Express alternative viable via better-auth Node adapter but Next.js minimizes glue.
**Alternatives:** Express + separate Vite frontend — viable, more plumbing for better-auth Node handler; Supabase/Firebase — rejected for learning goal.
**Rationale:** Minimizes integration friction with better-auth while maximizing learning of relational modeling and distributed presence.

### 3. Data Model: better-auth User as Root + Social Tables
**Chosen:**
```
// managed by better-auth (via adapter)
user(id, email, emailVerified, name, image, createdAt, updatedAt, username unique, displayUsername, bio, avatarUrl ...)
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

### 4. Auth Integration Pattern: Middleware + Server Helpers + WS Handshake
**Chosen:** 
- HTTP: Next.js middleware or per-route guard calling `auth.api.getSession({ headers })` — returns `session.user` or 401. Client uses `authClient` (better-auth client) for signUp/signIn/signOut/useSession.
- WebSocket: handshake reads better-auth session cookie (`better-auth.session_token` or configured cookie name) from `req.headers.cookie`, validates via `auth.api.getSession`, attaches `userId` to socket; unauthenticated sockets rejected. Single socket per user multiplexed for feed push, messaging, presence, typing, notifications.
- Authorization: after authentication, call central `canView(viewerId, post)` for visibility checks — decoupled from better-auth (auth proves who you are, `canView` proves what you can see).
**Alternative:** JWT bearer for WS — viable but better-auth default is cookie session; staying cookie-aligned avoids dual auth modes.

### 5. Visibility Enforcement: DB + Service Guard
**Chosen:** Central `canView(viewerId, post)` called on every read path (feed, search, profile, repost hydration). Enforced in SQL WHERE, not just app filtering. Index on `(authorId, visibility, createdAt)` and GIN on `tsvector`.
**Alternative:** RLS — deferred.

### 6. Feed Fan-out: Hybrid Push to Active + Pull for Offline
**Chosen:** Presence `SET presence:{userId} 1 EX 300` on WS connect + 30s heartbeat. On post create: fetch follower IDs, intersect with online set (Redis), push `new_post` via WS to online followers; offline served via pull `WHERE authorId IN (following+self) AND canView` on next feed request. Demonstrates both paths.
**Alternative:** Pure push (timeline tables) — storage heavy; pure pull — never teaches push.

### 7. Pagination: Cursor for Feed, Offset for Search
**Chosen:** Feed `WHERE id < :cursor ORDER BY id DESC LIMIT 20` (or `(createdAt,id)` composite). Search `LIMIT 20 OFFSET :page*20` with max page cap 100. Directly teaches offset drift (demo bug with two browsers, then fix).
**Alternative:** All offset — duplicates/skips on live feed; all cursor — no page jumps for search.

### 8. Ranking: Downvote Demotion
**Chosen:** `score = (up - down) - hours_since*0.5` with `effectiveScore = score - down*1.5` penalty, ordered in feed. Precompute `hotScore` column updated on vote or async job for MVP.
**Alternative:** Wilson/Reddit hot — deferred iteration.

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
- [Cursor pagination with ranking] Ordering by hotScore breaks id cursor -> Mitigation: MVP chronological `id DESC` with demotion filter; separate "Top" tab with `(hotScore,id)` cursor.
- [Offset deep pages slow] -> Mitigation: max page 100 cap, document cursor alternative.
- [Cloudinary quota] Unbounded uploads -> Mitigation: signed URL expiry, per-user rate limit, max size/mime validation, protected by better-auth session.
- [WS horizontal scale] User A on server 1, user B on server 2 cannot receive event -> Mitigation: Redis pub/sub adapter (Socket.io Redis adapter or custom), demo with 2 instances after single-instance works.
- [better-auth email verification blocking] Unverified user may still create posts if not gated -> Mitigation: decide policy (allow with `emailVerified` gate on write or not); spec requires authenticated session, optionally gate sensitive writes on `user.emailVerified`.

## Migration Plan

Greenfield — no migration. Deploy order:
1. Scaffold Next.js + Prisma + better-auth (adapter, `app/api/auth/[...all]/route.ts`, client, env), run adapter generate + `prisma migrate`, verify sign-up/sign-in/session/middleware + protected route -> deploy.
2. Add profile/social-graph/posts/replies/voting/bookmarks (HTTP only, `canView` guard using `session.user.id`) -> deploy, verify visibility.
3. Add Cloudinary signed uploads (protected by better-auth session), FTS search, feed cursor/offset, notification batching worker -> deploy, verify pagination.
4. Add WS server + presence + live notifications/typing/comments (WS auth via better-auth session) -> single instance -> deploy.
5. Add messaging (1:1 then groups) + read receipts -> deploy, test offline delivery.
6. Scale: second WS instance + Redis adapter, queue fan-out.

Rollback: each phase behind feature flag/routes; DB columns nullable first; better-auth adapter changes are additive; no destructive migrations at MVP.

## Open Questions

- OAuth providers: which to enable at MVP (email/password alone is sufficient; adding GitHub/Google later is non-breaking via better-auth config). Default to email/password + verification at MVP.
- better-auth session strategy: cookie session (default) vs JWT — defer; default to cookie as better-auth's primary, more secure for Next.js.
- Group admin permissions (who can add/remove, rename) — defer to messaging phase 2; MVP any member can add, creator is admin.
- Hot score tuning and search relevance weights — defer until base chronological feed + FTS work.
