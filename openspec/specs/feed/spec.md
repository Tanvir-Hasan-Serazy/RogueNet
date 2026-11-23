# Feed Specification

## Purpose
Delivers the home timeline via infinite scroll using viewer-specific EdgeRank ordering and a hybrid fan-out that pushes new posts to online followers and serves offline followers on next pull.

## Requirements

### Requirement: Edge-ranked home feed
The system SHALL provide a home feed for the authenticated viewer (via better-auth session) containing posts from followed users plus the viewer's own posts, ordered by a viewer-specific EdgeRank score descending with post id descending as the deterministic tie-breaker.

#### Scenario: Initial ranked feed load
- **WHEN** an authenticated viewer requests the feed without a cursor
- **THEN** the system returns the highest-EdgeRank visible posts they are authorized to see, up to the page limit, and an opaque next cursor

#### Scenario: Own posts included with self-affinity
- **WHEN** the authenticated viewer has their own visible posts
- **THEN** those posts are eligible for the feed using the self-affinity value

#### Scenario: Unauthenticated feed rejected
- **WHEN** a request without a valid better-auth session requests the home feed
- **THEN** the system returns 401

### Requirement: EdgeRank factors
EdgeRank SHALL combine affinity, edge weight, and time decay. Affinity SHALL derive from the follow graph (self, mutual follow, one-way follow, viewer is followed by author, no edge) and MAY include a capped recent-interaction bonus. Edge weight SHALL reflect content type (original post, reply, repost) and content richness. Time decay SHALL decrease monotonically with post age using a configurable half-life. Weights SHALL be configurable and consistent within a feed request.

#### Scenario: Stronger affinity ranks higher
- **WHEN** two posts have equal edge weight, age, and engagement, but one author has a stronger affinity to the viewer (for example mutual follow vs no follow)
- **THEN** the higher-affinity post appears earlier in the feed

#### Scenario: Fresher post ranks higher
- **WHEN** two posts have equal affinity, edge weight, and engagement but different ages
- **THEN** the fresher post has the higher EdgeRank and appears earlier

#### Scenario: Richer edge weight ranks higher
- **WHEN** two posts have equal affinity, age, and engagement but one has a richer edge weight (for example media attached or an original post vs a repost)
- **THEN** the higher-weight post appears earlier

### Requirement: Downvotes demote in EdgeRank
Downvotes SHALL reduce a post's EdgeRank score and SHALL NOT delete or globally hide the post.

#### Scenario: Downvoted post ranks lower
- **WHEN** two posts have equal affinity, edge weight, and age but one has more downvotes
- **THEN** the more-downvoted post receives the lower EdgeRank and appears later

#### Scenario: Downvote does not hide the post
- **WHEN** a post receives downvotes
- **THEN** it remains visible to viewers who are otherwise authorized to see it, at a lower rank

### Requirement: Edge-ranked cursor pagination
The system SHALL paginate the feed via an opaque cursor encoding the ranked `(score, id)` position and a ranking snapshot identity, and SHALL return posts strictly after that position without duplicates or skips.

#### Scenario: Paginate with edge-rank cursor
- **WHEN** a viewer requests the next page using the cursor returned from the previous page
- **THEN** the system returns posts strictly after the `(EdgeRank score, post id)` position encoded in the cursor without duplicates or skips

#### Scenario: Pagination snapshot stability
- **WHEN** new posts are inserted or a visible post's engagement changes after the viewer loaded page 1
- **THEN** page 2 SHALL continue against the same ranking snapshot so page 1 posts are not returned again and no eligible post between pages is skipped

#### Scenario: Cursor remains opaque to clients
- **WHEN** the feed responds with a next cursor
- **THEN** the cursor encodes the ranking position and snapshot identity as an opaque value and clients SHALL NOT be required to parse it

### Requirement: Hybrid fan-out to active users
The system SHALL push new posts in real time via WebSocket (authenticated via better-auth session) to followers who are currently online (presence-tracked), and SHALL serve offline followers via pull on their next feed request.

#### Scenario: Online follower receives push
- **WHEN** author A creates a post and follower B is online (presence key present, WS authenticated as B)
- **THEN** B SHALL receive a real-time feed event containing the post or an invalidation within seconds without polling

#### Scenario: Offline follower pulls on next request
- **WHEN** follower C is offline when the post is created and later requests the feed (with valid better-auth session)
- **THEN** the system returns the post in the ranked paginated results via DB query

### Requirement: Visibility and deletion respected in feed
The system SHALL exclude from the feed any post whose visibility does not allow the viewer (`session.user.id`), any soft-deleted post, and any repost whose original is not visible to the viewer.

#### Scenario: Followers-only post excluded for non-follower
- **WHEN** author A creates a followers-only post and viewer X does not follow A
- **THEN** X's feed SHALL NOT contain that post or reposts of it

### Requirement: Infinite scroll UX contract
The system SHALL return a next cursor only when more results exist, and SHALL return an empty next cursor at the end of the feed.

#### Scenario: End of feed
- **WHEN** a viewer paginates until no more posts exist
- **THEN** the system returns an empty list and a null next cursor
