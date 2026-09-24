## Why

Greenfield social network (roguenet) for learning — no existing codebase. The goal is to master every major full-stack hard problem (auth, authorization, fan-out, ranking, pagination, uploads, search, real-time) by shipping a product with the surface of X + Reddit + Messenger. Authentication is standardized on **better-auth** to avoid bespoke auth and to learn its session, plugin, and adapter model. This change defines the complete platform atop better-auth from day one.

## What Changes

New platform with phased delivery. No breaking changes (greenfield).

- **Auth (better-auth):** Email/password + email verification, cookie-based session management, Google and GitHub OAuth, and a user table owned by the Prisma adapter. All route protection delegates to better-auth via `auth.api.getSession` (no custom auth/middleware — thin wrapper only). Username/profile extension on top of Better Auth's `user` model.
- **Phase 0 — Identity:** Profiles (display name, bio, avatar) linked to better-auth user, follow/unfollow with follower graph
- **Phase 1 — Content:** Posts with three visibility levels (public / followers-only / private), media uploads via Cloudinary (image + video, signed direct upload), flat-threaded replies (single parent level + optional reply_to_user hint), simple reposts (hide everywhere if original deleted or becomes private/restricted)
- **Phase 2 — Engagement:** Upvote/downvote (downvote demotes in feed ranking, not deletion), bookmarks, vote state per user
- **Phase 3 — Distribution:** Home feed with infinite scroll (hybrid fan-out: push to presence-tracked active users via WebSocket, pull on read for offline), cursor pagination for feed + offset pagination for search page jumps, search with toggle `Posts | People` (Postgres FTS), batched notifications for upvotes/follows (5-min aggregation window)
- **Phase 4 — Real-time:** Real-time messaging 1:1 and group conversations (text + image, Messenger-style), live notifications, online presence, typing indicators, real-time comments — all multiplexed over authenticated WebSocket tied to better-auth session

Cross-cutting: soft deletes for posts, visibility enforcement on every read path (feed, search, reposts, replies), unread counts, signed Cloudinary uploads.

## Capabilities

### New Capabilities

- `auth`: Authentication and session management via better-auth (sign-up, sign-in, sign-out, session, email verification, password reset, OAuth, route protection)
- `profile`: User profile extension atop better-auth user (username unique, display name, bio, avatar URL, public profile views)
- `social-graph`: Follow/unfollow, follower/following lists and counts, follow-state checks for visibility
- `posts`: Post creation with visibility, Cloudinary media attachments, simple reposts with visibility/deletion inheritance, bookmarks
- `replies`: Flat-threaded replies to posts
- `voting`: Upvote/downvote per user per post, vote state persistence, downvote-driven demotion in ranking
- `feed`: Home/timeline feed, infinite scroll, hybrid fan-out (push to active, pull for offline), cursor pagination for feed
- `search`: Search with mode toggle (Posts vs People), full-text indexing, offset pagination for search
- `notifications`: Notification generation, batching/aggregation for upvotes and follows, live push via WebSocket, unread counts
- `messaging`: Conversations (1:1 and groups), participants/roles, text + image messages, history, read receipts
- `presence`: Online status via presence service (WebSocket + Redis TTL/heartbeat), typing indicators (ephemeral), real-time comments and live notification delivery

### Modified Capabilities

- (none — greenfield)

## Impact

- **Code:** Express API with Better Auth's Node handler, Next.js frontend, WebSocket/presence service, worker for notification batching, Postgres schema managed by Prisma 7, Redis for presence/pub-sub, and Cloudinary.
- **APIs:** Better Auth handles `/api/auth/*` through the Express adapter and is the sole authority for session validation (`auth.api.getSession`); the app adds REST/WS for all social capabilities plus `POST /api/media/sign` for Cloudinary. WebSocket auth also delegates to Better Auth session cookie. No custom auth middleware.
- **Dependencies:** `better-auth`, `@prisma/client` 7, `@prisma/adapter-pg`, Postgres, Redis, Cloudinary, WebSocket library (Socket.io/ws + Redis adapter), and a queue/worker (BullMQ/pg-boss) for batching.
- **Systems:** better-auth session table/adapter migration is source of truth for identity; all other tables FK to `user.id`; horizontal WS scaling requires Redis adapter; visibility checks must use `session.user.id` from better-auth on every read path.
