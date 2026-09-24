## 1. Project Bootstrap & better-auth Setup

- [x] 1.1 Initialize the existing Next.js/Express workspace with TypeScript, ESLint, Prisma 7, and Postgres configuration
- [x] 1.2 Install and configure Better Auth with the Prisma adapter, Express Node handler at `/api/auth/*`, cookie sessions, and Google/GitHub environment configuration
- [ ] 1.3 Apply the Prisma migration for `user/session/account/verification` and the optional `username`/`dob` user fields; the remote database migration is still pending
- [x] 1.4 Configure the frontend `authClient` for email sign-in/sign-up and Google/GitHub sign-in
- [x] 1.5 Verify better-auth session integration on app routes (thin `auth.api.getSession` delegation — no custom auth middleware; better-auth is the sole authority) — verify 401 without cookie and 200 with valid session via better-auth

## 2. Identity — Profile & Social Graph

- [ ] 2.1 Add profile fields and unique username constraint to the Prisma schema
- [ ] 2.2 Apply and verify the profile database migration
- [ ] 2.3 Implement profile validation and profile read endpoint
- [ ] 2.4 Implement profile update endpoint with authentication
- [ ] 2.5 Add profile tests for validation, duplicate username, and unauthenticated edits
- [ ] 2.6 Add the follows table and Prisma relations
- [ ] 2.7 Implement follow endpoint with self-follow rejection and idempotency
- [ ] 2.8 Implement unfollow endpoint and follower/following counts
- [ ] 2.9 Add follow/unfollow API tests using better-auth sessions
- [ ] 2.10 Implement paginated follower and following list endpoints
- [ ] 2.11 Add viewer follow-state and anonymous-user behavior
- [ ] 2.12 Add pagination and viewer-state integration tests

## 3. Content — Posts, Media, Replies, Voting, Bookmarks

- [ ] 3.1 Implement posts table with `visibility` enum, `deletedAt`, `mediaUrls jsonb`, `tsvector`, soft delete, and central `canView(viewerId, post)` guard using `session.user.id` on every read path, and verify non-follower fetching followers-only post returns 404
- [ ] 3.2 Implement Cloudinary signed direct upload endpoint (`POST /api/media/sign` protected by better-auth session) and post creation with Cloudinary URLs, and verify sign -> direct upload -> create post flow succeeds and unauthenticated sign returns 401
- [ ] 3.3 Implement simple reposts with inheritance (hide if `original.deletedAt` or original not visible to `session.user.id`), and verify repost hidden for all viewers after original soft-deleted via integration test
- [ ] 3.4 Implement flat-threaded replies (`postId` parent + `replyToUserId` hint) with chronological listing, reply counts, and verify reply to a reply stores `parent_post_id` = root post
- [ ] 3.5 Implement voting (PK user+post where user is `session.user.id`, value +-1, counts/score atomic) with viewer vote state in responses, and verify changing vote from +1 to -1 adjusts counts correctly and unauthenticated vote returns 401
- [ ] 3.6 Implement downvote demotion ranking (`score - down*1.5 - age*0.5`) and verify more downvoted post ranks lower in authenticated feed response
- [ ] 3.7 Implement bookmarks (PK user+post) with visibility check and list ordered by bookmark time, and verify bookmarking a private post of non-followed user returns 404

## 4. Distribution — Feed, Search, Notifications

- [ ] 4.1 Implement home feed pull path for authenticated viewer: `WHERE authorId IN (following+self) AND canView` with cursor pagination (`WHERE id < :cursor ORDER BY id DESC LIMIT 20`), and verify two browsers paginating with cursor see no duplicates after concurrent inserts and unauthenticated feed returns 401
- [ ] 4.2 Enforce pagination policy (cursor for feed, offset for search) and verify feed rejects offset param and search accepts offset/page, with test demonstrating offset drift bug on live feed
- [ ] 4.3 Implement hybrid fan-out: presence service (`SET presence:{userId} EX 300` + heartbeat) tied to better-auth WS identity, on post create intersect followers with online set and emit via WS, offline via pull, and verify online follower receives `feed:new` within 2s and offline sees post on next pull
- [ ] 4.4 Implement search with toggle `Posts | People` using Postgres `tsvector+GIN` for posts and `pg_trgm` for people, offset pagination, max page cap 100, and verify followers-only post not returned to non-follower in `posts` search
- [ ] 4.5 Implement notifications base (event generation for follow/reply/repost/mention with better-auth user IDs) and batched aggregation for upvotes/follows (5-min window via BullMQ/pg-boss + Redis buffer), and verify 3 upvotes within window produce single aggregated notification with count 3
- [ ] 4.6 Implement notification listing, mark one/all as read, unread counts, and verify unread count decrements and unauthenticated list returns 401

## 5. Real-time Foundations — WebSockets, Presence, Live Events

- [ ] 5.1 Add WebSocket server (Socket.io or ws) with better-auth session validation on handshake (`auth.api.getSession` from cookie), single multiplexed connection per `userId`, Redis adapter for horizontal scale, and verify valid session connects and invalid is rejected
- [ ] 5.2 Implement presence heartbeating (`presence:{userId}` TTL 60-120s) and online/offline exposure, and verify viewer sees `online:true` on connect and `online:false` after disconnect/TTL expiry with two authenticated clients
- [ ] 5.3 Implement live notification push over authenticated WS and verify online user receives `notification:new` without polling when batch flushes
- [ ] 5.4 Implement real-time comments (WS room `post:{id}`) and verify subscriber receives `comment:new` when another authenticated user replies
- [ ] 5.5 Implement typing indicators as ephemeral WS events (`typing:start/stop`, 3s timeout, not persisted) and verify other participants receive event and history fetch excludes typing

## 6. Messaging — 1:1 and Groups with Images

- [ ] 6.1 Implement conversations + participants model (isGroup flag, admin/member roles FK to better-auth user) with 1:1 deduplication, and verify same pair returns existing conversation ID and unauthenticated creation returns 401
- [ ] 6.2 Implement message persistence (text, Cloudinary imageUrl, or both) with sender `session.user.id` and paginated history, and verify non-participant fetch returns 403 and participant history returns ordered messages
- [ ] 6.3 Implement WS rooms per `conversation:{id}` for live delivery and verify participant B (authenticated WS) receives `message:new` within 1s when A sends, including image messages
- [ ] 6.4 Implement read receipts (per-user per-message `message_reads`) with real-time broadcast over authenticated WS, and verify marking read emits `message:read` to other participants
- [ ] 6.5 Implement group management (add member, leave group) with role checks, and verify added member receives subsequent messages but not prior history, leaving member stops receiving
- [ ] 6.6 Verify offline delivery: participant offline when 3 messages sent, then reconnects with better-auth session and fetches history — all 3 messages present in order

## 7. Hardening, Visibility Audits & Scale Demo

- [ ] 7.1 Add integration tests for visibility matrix (public/followers_only/private x author/follower/stranger/anon x direct/feed/search/repost/reply) using better-auth sessions for each actor, and verify all disallowed combos return 404/omission
- [ ] 7.2 Add rate limiting on Cloudinary sign and post/message create (protected by better-auth session), max file size/mime validation, and verify oversized upload rejected with 400
- [ ] 7.3 Demonstrate WS horizontal scaling: run 2 server instances with Redis adapter, connect user A (session on instance 1) and user B (session on instance 2), and verify message/presence event crosses instances
- [ ] 7.4 Seed script and manual QA for infinite scroll (cursor stability), batched notification flush (3 upvotes -> 1 notification), group typing with 3 authenticated users, and verify checklist passes in staging with better-auth sessions
