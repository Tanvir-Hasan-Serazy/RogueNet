# Replies Specification

## Purpose
Provides flat-threaded replies to posts so conversations stay shallow and quickly scannable while preserving who was replied to.

## Requirements

### Requirement: Create flat-threaded reply
The system SHALL allow an authenticated user (via better-auth session) to reply to a visible post, storing the reply as a child of the parent post with an optional reply_to_user hint, and SHALL keep threading flat (no nested depth).

#### Scenario: Reply to post
- **WHEN** an authenticated user who can view post P creates a reply with body text and optional reply_to_user_id
- **THEN** the system creates the reply linked to P with author `session.user.id` and timestamps

#### Scenario: Reply to reply stays flat
- **WHEN** a user replies in the context of another reply R on post P
- **THEN** the system still stores the new reply with parent_post_id = P (not R) and optionally reply_to_user_id = author of R

#### Scenario: Unauthenticated reply rejected
- **WHEN** a request without a valid better-auth session attempts to create a reply
- **THEN** the system returns 401

### Requirement: List replies for a post
The system SHALL return replies for a given post in chronological order with pagination, and SHALL enforce visibility of the parent post before returning replies.

#### Scenario: List replies in order
- **WHEN** a viewer who can view post P requests its replies
- **THEN** the system returns replies ordered by created_at ascending, paginated

#### Scenario: Replies hidden when parent not visible
- **WHEN** a viewer who cannot view parent post P requests its replies
- **THEN** the system returns not-found or empty as if the post does not exist

### Requirement: Reply count on post
The system SHALL maintain and expose a reply count per post that increments on reply creation and decrements on soft delete.

#### Scenario: Reply count reflects creation
- **WHEN** a reply is created on post P
- **THEN** the reply count on P increments by one and is visible in post responses
