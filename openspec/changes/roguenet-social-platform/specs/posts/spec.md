## Purpose

Enables creation and management of posts with visibility controls, media attachments via Cloudinary, simple reposts, and bookmarks as the core content primitive.

## ADDED Requirements

### Requirement: Create post with visibility
The system SHALL allow an authenticated user to create a post with body text, optional Cloudinary media URLs, and visibility `public`, `followers_only`, or `private`.

#### Scenario: Create public post
- **WHEN** an authenticated user creates a post with visibility public and valid body
- **THEN** the system persists it with the author, visibility, and timestamps and returns the post

#### Scenario: Create followers-only post
- **WHEN** a user creates a post with visibility followers_only
- **THEN** the system stores it and enforces that only followers and the author can view it on every read path

#### Scenario: Create private post
- **WHEN** a user creates a post with visibility private
- **THEN** the system stores it and ensures only the author can view it

### Requirement: Visibility enforcement on read
The system SHALL enforce visibility on every read path including direct fetch, feed, search, repost hydration, and replies, and SHALL never return a post the viewer is not authorized to see.

#### Scenario: Non-follower cannot see followers-only post
- **WHEN** a non-follower requests a followers-only post directly or via feed/search/repost
- **THEN** the system returns not-found or omits it from results as if it does not exist

### Requirement: Media attachments via Cloudinary
The system SHALL accept media as Cloudinary secure URLs (image and video) and SHALL validate via signed direct upload flow; the API SHALL provide a signing endpoint and SHALL NOT proxy file bytes.

#### Scenario: Post with Cloudinary image
- **WHEN** a user creates a post including a Cloudinary secure URL obtained via the signing endpoint
- **THEN** the system stores the URL and serves it in post responses

#### Scenario: Unsigned media rejected
- **WHEN** a user submits a media URL not matching the expected Cloudinary pattern or without a valid signature context where enforced
- **THEN** the system rejects with a validation error

### Requirement: Simple reposts with inheritance
The system SHALL allow a user to repost an existing visible post as a simple repost (no quote), and SHALL hide the repost from all viewers if the original is soft-deleted or its visibility becomes private or restricts the viewer.

#### Scenario: Repost visible post
- **WHEN** a user reposts a post they are authorized to view
- **THEN** the system creates the repost edge and it appears in feeds of the reposter's followers subject to original visibility

#### Scenario: Repost hidden when original deleted
- **WHEN** the original post is soft-deleted (deleted_at set)
- **THEN** all reposts of it SHALL be hidden from every viewer, including the reposter, on all read paths

#### Scenario: Repost hidden when original becomes private
- **WHEN** the original post's visibility changes to private
- **THEN** all reposts of it SHALL be hidden from every viewer except the original author context where applicable

### Requirement: Soft delete posts
The system SHALL soft-delete posts by setting deleted_at rather than hard deletion, and SHALL hide soft-deleted posts from all viewers except for author audit where explicitly allowed.

#### Scenario: Author deletes post
- **WHEN** the author deletes their post
- **THEN** the system sets deleted_at and the post no longer appears in feeds, search, or repost hydration for any viewer

### Requirement: Bookmarks
The system SHALL allow an authenticated user to bookmark and unbookmark any post they can view, and to list their bookmarks.

#### Scenario: Bookmark and list
- **WHEN** a user bookmarks a visible post and then lists bookmarks
- **THEN** the system returns the bookmarked post in the list ordered by bookmark time

#### Scenario: Bookmark hidden post not allowed
- **WHEN** a user attempts to bookmark a post they cannot view due to visibility or deletion
- **THEN** the system rejects with not-found
