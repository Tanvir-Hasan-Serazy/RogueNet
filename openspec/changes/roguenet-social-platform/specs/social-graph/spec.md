## Purpose

Manages the follower graph that controls content visibility and feed distribution, enabling users to follow and unfollow others.

## ADDED Requirements

### Requirement: Follow and unfollow users
The system SHALL allow an authenticated user to follow and unfollow another user, and SHALL prevent self-follow.

#### Scenario: Follow user
- **WHEN** user A follows user B who exists and is not already followed
- **THEN** the system creates the follow edge and increments follower/following counts

#### Scenario: Unfollow user
- **WHEN** user A unfollows user B who is currently followed
- **THEN** the system removes the follow edge and decrements counts

#### Scenario: Self-follow rejected
- **WHEN** a user attempts to follow themselves
- **THEN** the system rejects with a validation error

#### Scenario: Duplicate follow idempotent
- **WHEN** user A follows user B who is already followed
- **THEN** the system returns success without creating a duplicate edge

### Requirement: Follower and following lists
The system SHALL provide paginated lists of followers and following for any user, with follow-state relative to the viewer.

#### Scenario: Fetch followers list
- **WHEN** a viewer requests the followers of user B with a valid cursor/offset
- **THEN** the system returns the follower profiles and indicates which ones the viewer follows

### Requirement: Follow-state check for authorization
The system SHALL expose a follow-state check that other capabilities (posts visibility, feed) MUST use to decide if viewer is a follower.

#### Scenario: Visibility check uses follow state
- **WHEN** the feed or post viewer service checks if viewer X can see a followers-only post by author Y
- **THEN** the system returns true only if a follow edge X->Y exists
