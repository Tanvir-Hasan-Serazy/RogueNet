## Purpose

Implements upvote and downvote per better-auth user per post with persisted vote state and a demotion-based ranking signal for the feed.

## ADDED Requirements

### Requirement: Upvote and downvote with single vote per user per post
The system SHALL allow an authenticated user (via better-auth session) to cast exactly one vote per post with value +1 (upvote) or -1 (downvote), and SHALL allow changing or removing the vote.

#### Scenario: Upvote post
- **WHEN** an authenticated user upvotes a post they can view and have not voted on before
- **THEN** the system creates a vote (+1), increments up count, and updates the post score

#### Scenario: Change vote from up to down
- **WHEN** a user who previously upvoted the same post downvotes it
- **THEN** the system replaces the vote value to -1 and adjusts counts and score atomically

#### Scenario: Remove vote
- **WHEN** a user removes their existing vote on a post
- **THEN** the system deletes the vote edge and adjusts counts and score

#### Scenario: Viewer vote state returned
- **WHEN** a viewer (via better-auth session) fetches a post or feed that includes a post they voted on
- **THEN** the system includes the viewer's current vote value (1, -1, or null) in the response

#### Scenario: Unauthenticated vote rejected
- **WHEN** a request without a valid better-auth session attempts to vote
- **THEN** the system returns 401

### Requirement: Downvote demotes in feed ranking
The system SHALL use downvotes to demote posts in feed ordering (lower rank), not to delete or hide them from all users.

#### Scenario: Downvoted post ranks lower
- **WHEN** two posts have equal age and one has more downvotes
- **THEN** the feed SHALL order the more downvoted post lower when sorted by ranking

#### Scenario: Downvote does not hide from author
- **WHEN** a post receives downvotes
- **THEN** it SHALL still be visible to its author and to viewers who can otherwise see it, albeit at lower rank

### Requirement: Vote counts and score integrity
The system SHALL maintain accurate up count, down count, and derived score, and SHALL enforce uniqueness of (user_id, post_id) at the storage layer where user_id is `session.user.id`.

#### Scenario: Concurrent votes handled correctly
- **WHEN** two vote operations for the same user and post arrive concurrently
- **THEN** the system SHALL ensure only one vote edge exists and counts reflect exactly one vote
