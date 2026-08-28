## Purpose

Delivers the home timeline via infinite scroll using a hybrid fan-out that pushes new posts to online followers and serves offline followers on next pull.

## ADDED Requirements

### Requirement: Home feed with infinite scroll and cursor pagination
The system SHALL provide a home feed for the authenticated viewer containing posts from followed users plus the viewer's own posts, ordered reverse-chronologically (with ranking demotion as secondary), and SHALL paginate via cursor for infinite scroll.

#### Scenario: Initial feed load
- **WHEN** a viewer requests the feed without a cursor
- **THEN** the system returns the most recent visible posts they are authorized to see, up to the page limit, and a next cursor

#### Scenario: Paginate with cursor
- **WHEN** a viewer requests the next page using the cursor returned from the previous page (e.g., id < cursor)
- **THEN** the system returns the next posts strictly before the cursor without duplicates or skips even if new posts were inserted concurrently

#### Scenario: Cursor stability under inserts
- **WHEN** 5 new posts arrive after the viewer loaded page 1
- **THEN** requesting page 2 with the previous cursor SHALL NOT return duplicates from page 1

### Requirement: Hybrid fan-out to active users
The system SHALL push new posts in real time via WebSocket to followers who are currently online (presence-tracked), and SHALL serve offline followers via pull on their next feed request.

#### Scenario: Online follower receives push
- **WHEN** author A creates a post and follower B is online (presence key present)
- **THEN** B SHALL receive a real-time feed event containing the post or an invalidation within seconds without polling

#### Scenario: Offline follower pulls on next request
- **WHEN** follower C is offline when the post is created and later requests the feed
- **THEN** the system returns the post in the paginated results via DB query as if it had been pushed

### Requirement: Visibility and deletion respected in feed
The system SHALL exclude from the feed any post whose visibility does not allow the viewer, any soft-deleted post, and any repost whose original is not visible to the viewer.

#### Scenario: Followers-only post excluded for non-follower
- **WHEN** author A creates a followers-only post and viewer X does not follow A
- **THEN** X's feed SHALL NOT contain that post or reposts of it

### Requirement: Infinite scroll UX contract
The system SHALL return a next cursor only when more results exist, and SHALL return an empty next cursor at the end of the feed.

#### Scenario: End of feed
- **WHEN** a viewer paginates until no more posts exist
- **THEN** the system returns an empty list and a null next cursor
