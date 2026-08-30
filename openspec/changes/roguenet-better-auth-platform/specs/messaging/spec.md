## Purpose

Provides Messenger-style real-time messaging for 1:1 and group conversations with text, images, history, and read receipts.

## ADDED Requirements

### Requirement: Create 1:1 and group conversations
The system SHALL allow authenticated users (via better-auth session) to create a 1:1 conversation with another user and to create a group conversation with multiple participants, and SHALL persist participants and roles linked to better-auth `user.id`.

#### Scenario: Create 1:1 conversation
- **WHEN** user A (authenticated) creates a 1:1 conversation with user B
- **THEN** the system creates the conversation with participants A and B and returns its ID; creating the same pair again SHALL return the existing conversation

#### Scenario: Create group conversation
- **WHEN** user A creates a group conversation with users B and C and a group name
- **THEN** the system creates the group with all participants and role member (creator as admin)

#### Scenario: Unauthenticated conversation creation rejected
- **WHEN** a request without a valid better-auth session attempts to create a conversation
- **THEN** the system returns 401

### Requirement: Send and receive messages (text + image)
The system SHALL allow participants (verified via `session.user.id` membership) to send messages containing text, an image URL (Cloudinary), or both, and SHALL persist history in send order.

#### Scenario: Send text message
- **WHEN** a participant sends a text message in a conversation they belong to
- **THEN** the system persists it with sender `session.user.id` and delivers it in real time via WebSocket to all other participants

#### Scenario: Send image message
- **WHEN** a participant sends a message with a Cloudinary image URL
- **THEN** the system persists the image URL and delivers it like a text message

#### Scenario: Non-participant cannot send
- **WHEN** a user who is not a participant attempts to send a message to that conversation
- **THEN** the system rejects with forbidden

### Requirement: Message history and pagination
The system SHALL return message history for a conversation paginated in chronological or reverse-chronological order, only to participants (authenticated via better-auth).

#### Scenario: Fetch history as participant
- **WHEN** a participant (via better-auth session) requests message history with a cursor/limit
- **THEN** the system returns messages in order with the next cursor

#### Scenario: Non-participant cannot fetch history
- **WHEN** a non-participant requests history of a conversation
- **THEN** the system rejects with forbidden or not-found

### Requirement: Read receipts
The system SHALL track per-user (better-auth `user.id`) per-message read state and SHALL broadcast read updates to participants in real time via authenticated WebSocket.

#### Scenario: Read receipt broadcast
- **WHEN** participant B marks messages up to message M as read
- **THEN** other participants SHALL receive a real-time read receipt event indicating B read up to M

### Requirement: Group management
The system SHALL allow group participants to add members and leave groups; admin role controls where applicable.

#### Scenario: Add member to group
- **WHEN** a participant adds a new user to a group conversation
- **THEN** the new user becomes a participant and can send/receive subsequent messages but cannot see prior history unless explicitly allowed by policy

#### Scenario: Leave group
- **WHEN** a participant leaves a group
- **THEN** they are removed from participants and no longer receive messages or history access beyond their membership period
