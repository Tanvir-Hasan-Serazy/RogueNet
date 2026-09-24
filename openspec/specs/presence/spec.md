# Presence Specification

## Purpose
Tracks online presence, typing indicators, and live delivery for comments and notifications so the product feels truly real-time atop better-auth sessions.

## Requirements

### Requirement: Online status via presence service
The system SHALL track online status via WebSocket connections authenticated with better-auth sessions, with a heartbeat and TTL, and SHALL expose online/offline state to other users.

#### Scenario: User appears online on connect
- **WHEN** a user establishes an authenticated WebSocket connection (validated via better-auth session)
- **THEN** the system sets their presence key with TTL and other users viewing their profile or participant list SHALL see online true

#### Scenario: User appears offline after disconnect
- **WHEN** a user disconnects or heartbeat TTL expires
- **THEN** the system clears or expires their presence key and viewers SHALL see online false or last seen time

#### Scenario: Unauthenticated presence not tracked
- **WHEN** a WebSocket without a valid better-auth session attempts to set presence
- **THEN** the system rejects and does not mark the user online

### Requirement: Typing indicators (ephemeral)
The system SHALL broadcast ephemeral typing start/stop events within a conversation or post comment context to relevant participants (authenticated via better-auth), with automatic timeout, and SHALL NOT persist them.

#### Scenario: Typing start broadcast
- **WHEN** participant A (authenticated) starts typing in conversation C
- **THEN** other participants in C who are online SHALL receive a typing start event for A within a second

#### Scenario: Typing timeout
- **WHEN** a typing start event is sent and no typing stop or message arrives within 3 seconds
- **THEN** viewers SHALL consider typing ended without requiring an explicit stop event

#### Scenario: Typing not persisted
- **WHEN** a viewer fetches conversation history after a typing event occurred
- **THEN** the history SHALL NOT contain typing events

### Requirement: Real-time comments
The system SHALL deliver new replies to a post in real time to viewers subscribed to that post's room, in addition to persisting them, where subscription is authenticated via better-auth where required.

#### Scenario: Live comment delivery
- **WHEN** user A (authenticated) creates a reply on post P while viewer B is subscribed to post P's room
- **THEN** B SHALL receive a real-time comment event containing the reply without polling

### Requirement: Live notification delivery
The system SHALL deliver notifications via the same authenticated WebSocket multiplexed connection used for presence and messaging.

#### Scenario: Live notification over existing socket
- **WHEN** a notification is generated for an online user with an active authenticated socket
- **THEN** the system delivers it over that socket as a notification event without requiring a separate connection
