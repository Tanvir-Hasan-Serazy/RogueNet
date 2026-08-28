## Purpose

Provides discovery via search with a toggle between posts and people, using full-text search for posts and prefix search for users.

## ADDED Requirements

### Requirement: Search mode toggle Posts vs People
The system SHALL provide a search endpoint that accepts a query and a mode (`posts` or `people`) and returns results of the selected type.

#### Scenario: Search posts mode
- **WHEN** a viewer searches with mode posts and query "hello"
- **THEN** the system returns posts whose body matches the query, respecting visibility for the viewer, ordered by relevance then recency

#### Scenario: Search people mode
- **WHEN** a viewer searches with mode people and query "ali"
- **THEN** the system returns users whose username or display name matches the prefix, ordered by relevance

### Requirement: Visibility-aware post search
The system SHALL exclude from post search results any post the viewer is not authorized to see due to visibility or soft delete, including via repost hydration.

#### Scenario: Followers-only post not in search for non-follower
- **WHEN** a non-follower searches for terms that match a followers-only post
- **THEN** that post SHALL NOT appear in results

### Requirement: Offset pagination for search
The system SHALL paginate search results with offset-based pagination (limit + offset/page) to support page jumps, with a reasonable max page cap.

#### Scenario: Paginate search with offset
- **WHEN** a viewer requests page 2 of search results with limit 20 offset 20
- **THEN** the system returns the next 20 results in stable relevance order

#### Scenario: Empty query handling
- **WHEN** a viewer searches with an empty or whitespace-only query
- **THEN** the system returns an empty result set or a validation error, not all posts

### Requirement: Full-text indexing
The system SHALL index posts for full-text search (e.g., Postgres tsvector + GIN) and SHALL update the index on post create/edit/delete so search reflects current content.

#### Scenario: New post appears in search
- **WHEN** a user creates a post containing the term "roguenet"
- **THEN** a subsequent search for "roguenet" in posts mode SHALL return that post (subject to visibility)
