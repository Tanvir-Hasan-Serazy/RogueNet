## Purpose

Generates and delivers notifications for social interactions with batched aggregation for high-frequency events and real-time push for immediacy.

## ADDED Requirements

### Requirement: Notification generation for social events
The system SHALL generate notifications for follows, replies, reposts, and mentions, and SHALL batch upvotes and follows within a time window.

#### Scenario: Follow creates notification
- **WHEN** user A follows user B
- **THEN** user B SHALL receive a notification that A followed them (subject to batching if many follows arrive within the window)

#### Scenario: Reply creates notification
- **WHEN** user A replies to post P by user B
- **THEN** user B SHALL receive a notification for the reply

### Requirement: Batching for upvotes and follows
The system SHALL buffer upvote and follow events per receiver and target for a 5-minute window and aggregate them into a single notification (e.g., "3 people liked your post"), and SHALL flush the buffer even if the worker restarts.

#### Scenario: Multiple upvotes batched
- **WHEN** 3 different users upvote the same post by receiver R within 5 minutes
- **THEN** R SHALL receive a single aggregated notification with count 3 rather than 3 separate notifications

#### Scenario: Batch window flush
- **WHEN** the 5-minute window elapses after the first buffered event
- **THEN** the system SHALL persist and deliver the aggregated notification and clear the buffer

### Requirement: Live push and unread counts
The system SHALL push new notifications in real time via WebSocket to online receivers and SHALL maintain unread counts.

#### Scenario: Online user receives live notification
- **WHEN** a notification is created for an online user
- **THEN** the user SHALL receive a real-time event within seconds without polling

#### Scenario: Unread count
- **WHEN** a user has 2 unread notifications and marks one as read
- **THEN** the system SHALL return unread count 1 on the next fetch

### Requirement: List and mark notifications
The system SHALL allow a user to list their notifications paginated and to mark one or all as read.

#### Scenario: Mark all as read
- **WHEN** a user marks all notifications as read
- **THEN** all their notifications become read and unread count becomes zero
