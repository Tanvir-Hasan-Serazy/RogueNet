## Context

Greenfield social platform (roguenet) with no existing code. See proposal.md Why for motivation. Constraints: learning-oriented (must expose hard problems deliberately), single initial deploy target (one region), small team / solo dev, must be horizontally extendable later without rewrite. Must support 10 capabilities from identity through real-time presence without building two separate products.

## Goals / Non-Goals

**Goals:**
- Phased delivery that is deployable after each level (identity -> content -> engagement -> distribution -> real-time) without schema-breaking migrations.
- Data model that supports visibility (public/followers-only/private) and soft-delete inheritance for reposts on day one.
- Hybrid fan-out that demonstrates both push (active users) and pull (offline) without requiring Kafka at MVP.
- Pagination correctness for infinite scroll (cursor) while retaining offset for search jump navigation.
- Search that works without Elasticsearch initially but can migrate to Typesense/Meilisearch/ES later.
- Real-time layer that reuses presence for feed fan-out, messaging, typing indicators, and live notifications.

**Non-Goals:**
- Recommendation ML / algorithmic For You feed beyond simple hot score (downvote demotion + recency).
- End-to-end encryption for messaging.
- Video transcoding pipeline beyond what Cloudinary provides.
- Multi-region / edge replication.
- Native mobile push (FCM/APNs) — web live notifications only at MVP.

## Decisions

### 1. Stack: Postgres + Prisma (or Drizzle) + Redis + WebSockets + Cloudinary
**Chosen:** Postgres as source of truth (relational, FTS, row-level checks), Redis for presence TTL + pub/sub, WebSockets via Socket.io or `ws` + Redis adapter, Cloudinary for media via signed direct upload, queue via BullMQ or pg-boss for notification batching. API layer Next.js (App Router) + Prisma or Express + Prisma — leave framework choice to implementer but DB/Redis contracts fixed.
**Alternatives considered:** Firebase/Supabase Realtime (faster to ship, hides hard problems — rejected for learning goal), MongoDB (weaker for graph + visibility joins), S3 + self-hosted image processing (more ops than Cloudinary for MVP).
**Rationale:** Maximizes learning of relational modeling, authz, and distributed presence while minimizing undifferentiated ops.

### 2. Data Model: Single posts table + join tables
**Chosen:**
```
users(id, username unique, display_name, bio, avatar_url, created_at)
follows(follower_id, following_id, created_at) PK(follower_id,following_id)
posts(id, author_id FK, body text, visibility enum('public','followers_only','private'), media_urls jsonb, deleted_at nullable, created_at, tsvector)
reposts(id, user_id, original_post_id FK, created_at) unique(user_id, original_post_id)
replies(id, post_id FK, author_id FK, body, reply_to_user_id nullable FK, created_at)  -- post_id is parent post
votes(user_id, post_id, value int CHECK +/-1, created_at) PK(user_id,post_id)
bookmarks(user_id, post_id, created_at) PK(user_id,post_id)
conversations(id, is_group bool, name nullable, created_at)
conversation_participants(conversation_id, user_id, role enum('admin','member'), joined_at) PK(conv, user)
messages(id, conversation_id FK, sender_id FK, body text nullable, image_url nullable, created_at)
message_reads(message_id, user_id, read_at) PK(message_id,user_id)
notifications(id, receiver_id, type enum('follow','like','repost','reply','message'), actor_id, target_id, aggregated_count int default 1, body text, is_read bool, created_at)
```
Soft delete via `deleted_at`; reposts hide when `original.deleted_at IS NOT NULL OR original.visibility='private' OR (original.visibility='followers_only' AND viewer not follower)`.
**Alternatives:** Separate tables per content type — rejected as UNION complexity for feed. Document DB — rejected for join-heavy visibility checks.

### 3. Visibility Enforcement: DB + Service Layer Guard
**Chosen:** Central `canView(viewerId, post)` function called on every read path (feed, search, profile, repost hydration). Enforced in SQL WHERE clauses, not just app filtering, to prevent leakage via search/reposts. Index on `(author_id, visibility, created_at)` and GIN on `tsvector`.
**Alternative:** Row-level security (RLS) — considered but adds complexity for learning MVP; can be added later.

### 4. Feed Fan-out: Hybrid Push to Active + Pull for Offline
**Chosen:** Presence service: `SET presence:{userId} 1 EX 300` on WS connect + heartbeat 30s; `SMEMBERS` or `SCAN` for online set. On post create: fetch follower IDs, intersect with online set (Redis `SMEMBERS` or Lua), push `new_post` event via WS to online followers; offline followers read via pull query `SELECT ... WHERE author_id IN (following) AND canView(...) ORDER BY id DESC LIMIT 20` on next feed load. This demonstrates both paths.
**Alternative:** Pure push (fan-out on write) — storage heavy, needs timeline tables. Pure pull — simple but never teaches push. Kafka — overkill for MVP.
**Trade:** Online set lookup is O(followers); for 100k followers, need pagination/batched push via queue — noted as future optimization, not MVP blocker.

### 5. Pagination: Cursor for Feed, Offset for Search
**Chosen:** Feed uses keyset cursor `WHERE id < :cursor ORDER BY id DESC LIMIT 20` (or `created_at, id` composite for stable ordering). Search uses offset `LIMIT 20 OFFSET :page*20` because users expect page jumps. This directly teaches why offset drifts on live feeds (demonstrate bug with two browsers, then fix).
**Alternative:** All offset — rejected due to duplicate/skip under concurrent inserts. All cursor — rejected because search UX wants page numbers.

### 6. Ranking: Downvote Demotion
**Chosen:** Base score `score = (up - down) - (hours_since_post * decay 0.5)` with downvote-weighted demotion `effectiveScore = score - down*penalty` (penalty 1.5). Applied in feed ORDER BY, not as deletion. Allow per-viewer personalization later (follow affinity). Precompute `hot_score` column updated on vote or async job for MVP; real-time recompute not required.
**Alternative:** Wilson score / Reddit hot — deferred to iteration after base works; learning value is building any ranker first.

### 7. Search: Postgres FTS First, Pluggable
**Chosen:** Postgres `tsvector` + `GIN` for posts (`body` + username), trigram `pg_trgm` for people prefix search. Toggle `Posts | People` maps to two queries. Abstract behind `SearchService` interface so Typesense/Meilisearch can replace without touching callers.
**Alternative:** Elasticsearch from day one — heavier ops, hides FTS learning.

### 8. Media: Signed Direct Upload to Cloudinary
**Chosen:** Client requests signed params from API (`/api/media/sign`), uploads directly to Cloudinary, returns `secure_url` + `public_id` which client sends in post/message create. API never proxies bytes. Eager transformations for thumbnails.
**Alternative:** Proxy through server — simpler auth but doubles bandwidth and memory.

### 9. Notifications: Buffered Aggregation
**Chosen:** Events (`follow`, `upvote`) push to buffer key `notif:{type}:{targetId}:{receiverId}` with 5-min window in Redis or DB. Worker (BullMQ/pg-boss or setInterval for MVP) aggregates `count` and inserts single notification `"{N} people liked your post"` + live WS push `notification:new`. Unread count via `COUNT WHERE is_read=false`.
**Alternative:** Immediate insert per event — creates spam, no batching lesson.

### 10. Messaging: Conversations + Participants Model for 1:1 and Groups
**Chosen:** Unified `conversations` table with `is_group` flag. 1:1 conversation is still a conversation with 2 participants (enforces uniqueness via deterministic ID or lookup). Messages append-only. WS rooms per `conversation:{id}` for fan-out; read receipts per user per message. Typing indicator is ephemeral WS event `typing:start/stop` with 3s timeout, not persisted.
**Alternative:** Separate 1:1 and group tables — more duplication. XMPP-style — overkill.

### 11. Presence & Real-time Comments
**Chosen:** Same presence service drives online badges + feed fan-out. Real-time comments: WS room `post:{id}` — on reply create, broadcast `comment:new` to room subscribers. Live notifications reuse same WS connection (single socket, multiplexed events).

## Risks / Trade-offs

- [Presence TTL drift] Client disconnect without close may show online for up to 5 min → Mitigation: short TTL (60-120s) + heartbeat, show "last seen" not just binary.
- [Fan-out thundering herd] Post by user with 50k followers intersects large online set → Mitigation: push via queue/worker in batches, not inline request; cap MVP to small follower counts and document limit.
- [Visibility leakage via repost/search] Repost hydration or search could expose followers-only post to non-follower → Mitigation: central `canView` guard, add integration tests that assert non-follower cannot fetch via any endpoint, including via repost ID.
- [Cursor pagination with ranking] Once feed is ordered by `hot_score` not `id`, cursor on `id` breaks → Mitigation: MVP feed ordered by `id DESC` (chronological) with demotion filter; ranker is secondary sort or separate "Top" tab with its own cursor on `(hot_score, id)`.
- [Offset pagination performance] Deep search pages `OFFSET 50000` slow → Mitigation: acceptable for learning MVP; document cursor alternative and add `LIMIT` cap (e.g. max page 100).
- [Cloudinary cost/quota] Unbounded uploads → Mitigation: per-user rate limit, max file size, allowed mime types, signed upload expiry.
- [WS horizontal scaling] Two server instances: user A on server 1 cannot receive event emitted on server 2 → Mitigation: Redis pub/sub adapter (Socket.io Redis adapter or custom). Teach this by deploying 2 instances locally after single-instance works.
- [Notification loss on worker crash] Buffered events in memory lost → Mitigation: persist buffer in Redis/DB, not just memory; worker acks after write.
- [Group messaging fan-out N^2] Read receipts + typing in 100-member group spam → Mitigation: debounce typing (1 event per 3s), batch read receipts.

## Migration Plan

Greenfield — no migration. Deploy order matches Decisions phased delivery:
1. Postgres + Redis + API + auth + profile/social-graph/posts/replies/voting/bookmarks (HTTP only) → deploy, verify visibility guards.
2. Add Cloudinary signed uploads, FTS search, feed with cursor/offset, notification batching worker → deploy, load test pagination.
3. Add WS server + presence + live notifications/typing/comments → deploy single instance, test heartbeat.
4. Add messaging (1:1 then groups) + WS rooms + read receipts → deploy, test offline delivery.
5. Scale: add second WS instance + Redis adapter, queue fan-out, re-evaluate hot_score materialization.

Rollback: each phase behind feature flag or separate routes; DB columns added nullable first, no destructive migrations at MVP.

## Open Questions

- Framework choice (Next.js vs Express + separate frontend) — defer; DB/Redis contracts make it swappable. Default to Next.js App Router for full-stack learning if undecided.
- Exact hot_score formula tuning — defer to after base chronological feed works; will iterate with real data.
- Search relevance tuning (weights for title vs body vs username) — defer until FTS is wired.
- Group admin permissions (who can add/remove, rename) — defer to messaging phase 2; MVP: any member can add.
