## Why

Greenfield social network for learning: there is no existing codebase. The goal is to build a system that exercises every major backend/frontend hard problem — auth, authorization, fan-out, ranking, pagination, file uploads, search, and real-time state — by shipping a product with the surface area of X + Reddit + Messenger. This is intentionally broad to force mastery of distributed and product concerns, not just CRUD.

## What Changes

New platform with phased delivery. No breaking changes (greenfield).

- **Phase 0 — Identity:** User profiles, auth, follow/unfollow with follower graph
- **Phase 1 — Content:** Posts with three visibility levels (public / followers-only / private), media uploads via Cloudinary (image + video), flat-threaded replies, simple reposts (hide everywhere if original deleted or made private)
- **Phase 2 — Engagement:** Upvote/downvote (downvote demotes in feed ranking, not delete), bookmarks, repost/bookmark collections
- **Phase 3 — Distribution:** Home feed with infinite scroll (hybrid fan-out: push to active/online users via WebSocket, pull on read for offline users), cursor pagination for feed + offset pagination for search page jumps, search with toggle `Posts | People` (full-text), batch notifications for upvotes/follows (5-min aggregation window)
- **Phase 4 — Real-time:** Real-time messaging 1:1 and group conversations (text + image, Messenger-style), live notifications, online presence, typing indicators, real-time comments

Cross-cutting: soft deletes for posts, visibility enforcement on every read path (feed, search, reposts, replies), signed direct uploads to Cloudinary, unread counts.

## Capabilities

### New Capabilities
- `profile`: User identity, profile CRUD, avatar/bio, public profile views
- `social-graph`: Follow/unfollow, follower/following lists and counts, follow-state checks for visibility
- `posts`: Post creation with visibility, Cloudinary media attachments, simple reposts with inheritance of visibility/deletion, bookmarks
- `replies`: Flat-threaded replies to posts (single parent level, optional reply_to_user hint)
- `voting`: Upvote/downvote per user per post, vote state persistence, score calculation, downvote-driven demotion in feed ranking
- `feed`: Home/timeline feed, infinite scroll, hybrid fan-out (push to presence-tracked active users, pull for offline), cursor pagination for feed
- `search`: Search with mode toggle (Posts vs People), full-text indexing, offset pagination for search results
- `notifications`: Notification generation, 5-min batching/aggregation for upvotes and follows, live push via WebSocket, unread counts, per-type preferences
- `messaging`: Conversations (1:1 and groups), participants/roles, text + image messages, message history, read receipts, Messenger-style UX
- `presence`: Online status via presence service (WebSocket + Redis TTL/heartbeat), typing indicators (ephemeral), real-time comments and live notification delivery

### Modified Capabilities
- (none — greenfield)

## Impact

- **Code:** New repo — API (REST or GraphQL), WebSocket/presence service, worker for notification batching, DB schema (Postgres), Redis for presence/pub-sub, Cloudinary integration, CDN.
- **APIs:** New REST/WS contracts for all capabilities above; signed upload endpoint.
- **Dependencies:** Postgres, Redis, Cloudinary, WebSocket library (e.g. Socket.io/ws), queue/worker (BullMQ/pg-boss) for batching, FTS (Postgres tsvector initially, path to Typesense/Meilisearch).
- **Systems:** Requires horizontal WS scaling consideration (Redis adapter), soft-delete discipline, visibility checks on every read path to avoid leakage.
