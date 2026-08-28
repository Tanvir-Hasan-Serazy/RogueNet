## 1. Project Bootstrap

- [ ] 1.1 Initialize repo (Next.js App Router or Express + Vite) with TypeScript, ESLint, Prisma/Drizzle, Postgres connection, and verify `npm run dev` starts and connects to DB
- [ ] 1.2 Configure Postgres, Redis, Cloudinary env, Prisma schema with initial `users` table, and verify `prisma migrate dev` succeeds and `redis-cli ping` returns PONG
- [ ] 1.3 Implement auth (JWT or session) with register/login/me endpoints and verify login returns token and protected routes reject unauthenticated requests with 401

## 2. Identity — Profile & Social Graph

- [ ] 2.1 Implement profile CRUD (username unique, display_name, bio, avatar_url) with validation and verify profile update and duplicate username returns 409
- [ ] 2.2 Implement follow/unfollow with `follows` table, self-follow rejection, idempotent follow, follower/following counts, and verify follow -> counts increment and unfollow -> decrement via API tests
- [ ] 2.3 Implement follower/following list endpoints with pagination and follow-state relative to viewer, and verify paginated response includes `viewer_follows` flag

## 3. Content — Posts, Media, Replies, Voting, Bookmarks

- [ ] 3.1 Implement posts table with `visibility` enum, `deleted_at`, `media_urls jsonb`, `tsvector`, soft delete, and `canView(viewerId, post)` guard used on all read paths, and verify non-follower cannot fetch followers-only post returns 404
- [ ] 3.2 Implement Cloudinary signed direct upload endpoint (`POST /api/media/sign`) and post creation with Cloudinary URLs, and verify client can sign -> upload to Cloudinary -> create post with returned URL succeeds
- [ ] 3.3 Implement simple reposts with inheritance (hide if `original.deleted_at` or original not visible to viewer) and verify repost hidden for all viewers after original soft-deleted via integration test
- [ ] 3.4 Implement flat-threaded replies (`replies` with `post_id` parent + `reply_to_user_id`) with chronological listing and reply counts, and verify reply to a reply still has `parent_post_id` = root post via test
- [ ] 3.5 Implement voting (votes PK user+post, value +/-1, up/down counts, score, atomic upsert) with viewer vote state in responses, and verify vote change from +1 to -1 adjusts counts correctly in concurrent test
- [ ] 3.6 Implement downvote demotion ranking (`score - down*penalty - age*decay`) and feed ordering, and verify more downvoted post ranks lower in feed response than equal-age upvoted post
- [ ] 3.7 Implement bookmarks (PK user+post, list ordered by bookmark time) with visibility check, and verify bookmarking a private post of non-followed user returns 404 and bookmark list returns ordered results

## 4. Distribution — Feed, Search, Notifications

- [ ] 4.1 Implement home feed pull path: `WHERE author_id IN (following + self) AND canView` with cursor pagination (`WHERE id < :cursor ORDER BY id DESC LIMIT 20`), and verify two browsers paginating with cursor see no duplicates after 5 concurrent inserts
- [ ] 4.2 Demonstrate offset pagination bug and then enforce policy: feed uses cursor, search uses offset — add test that asserts feed endpoint rejects offset param and search endpoint accepts it
- [ ] 4.3 Implement hybrid fan-out: presence service (`SET presence:{userId} EX 300` + heartbeat), on post create intersect followers with online set and emit via WS, offline served via pull — verify online follower receives WS `feed:new` within 2s and offline follower sees post on next pull
- [ ] 4.4 Implement search with toggle `Posts | People` using Postgres `tsvector+GIN` for posts and `pg_trgm` for people, with offset pagination and max page cap, and verify followers-only post not returned to non-follower in `posts` search
- [ ] 4.5 Implement notifications base (DB table, event generation for follow/reply/repost) and batched aggregation for upvotes/follows (5-min window via BullMQ/pg-boss or Redis buffer + worker), and verify 3 upvotes within window produce single aggregated notification with count 3
- [ ] 4.6 Implement notification listing, mark one/all as read, unread counts, and verify unread count decrements correctly after mark-as-read

## 5. Real-time Foundations — WebSockets, Presence, Live Events

- [ ] 5.1 Add WebSocket server (Socket.io or ws) with auth, single multiplexed connection per user, Redis adapter for horizontal scale, and verify authenticated client connects and unauthenticated is rejected
- [ ] 5.2 Implement presence heartbeating and online/offline API/WS exposure, and verify viewer sees `online: true` on connect and `online: false` after disconnect/TTL expiry within 10s in test with two clients
- [ ] 5.3 Implement live notification push over WS and verify online user receives `notification:new` event without polling when a batched notification flushes
- [ ] 5.4 Implement real-time comments (WS room `post:{id}`) and verify subscriber to post room receives `comment:new` when another user replies
- [ ] 5.5 Implement typing indicators as ephemeral WS events (`typing:start/stop`) with 3s timeout, not persisted, and verify typing event received by other participants and not stored in history fetch

## 6. Messaging — 1:1 and Groups with Images

- [ ] 6.1 Implement conversations + participants model (is_group flag, admin/member roles) with 1:1 deduplication, and verify creating same 1:1 pair twice returns same conversation ID
- [ ] 6.2 Implement message persistence (text, Cloudinary image_url, or both) with send-order history and pagination, and verify history paginated correctly and non-participant fetch returns 403
- [ ] 6.3 Implement WS rooms per `conversation:{id}` for live delivery and verify participant B receives `message:new` within 1s when A sends, including image messages
- [ ] 6.4 Implement read receipts (per-user per-message, `message_reads`) with real-time broadcast, and verify marking read emits `message:read` to other participants
- [ ] 6.5 Implement group management (add member, leave group) and verify added member receives subsequent messages but not prior history, and leaving member no longer receives new messages
- [ ] 6.6 Verify offline message delivery: participant offline when 3 messages sent, then reconnects and fetches history — all 3 messages present in correct order

## 7. Hardening, Visibility Audits & Scale Demo

- [ ] 7.1 Add central `canView` integration tests covering matrix (public/followers_only/private x author/follower/stranger/anon x direct/feed/search/repost/reply) and verify all disallowed combos return 404/omission
- [ ] 7.2 Add rate limiting on Cloudinary sign and post/message create, max file size and mime validation, and verify oversized upload rejected with 400
- [ ] 7.3 Demonstrate WS horizontal scaling: run 2 server instances with Redis adapter, connect user A to instance 1 and user B to instance 2, and verify message/presence event crosses instances
- [ ] 7.4 Add seed script and manual QA checklist for infinite scroll (cursor stability), batch notification flush, and group typing in 3-user group, and verify checklist passes in staging

