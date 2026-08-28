## Purpose

Provides user identity and profile management so every social interaction has a stable, discoverable owner with editable public presence.

## ADDED Requirements

### Requirement: Profile creation and editing
The system SHALL allow an authenticated user to create and edit their profile including username, display name, bio, and avatar URL.

#### Scenario: User updates profile
- **WHEN** an authenticated user submits valid profile fields (unique username, display name, bio, avatar URL)
- **THEN** the system persists the changes and returns the updated profile

#### Scenario: Username uniqueness enforced
- **WHEN** a user attempts to set a username already taken by another user
- **THEN** the system rejects the update with a conflict error and does not modify the profile

### Requirement: Public profile viewing
The system SHALL allow any viewer (authenticated or anonymous) to fetch a user's public profile by username.

#### Scenario: View existing profile
- **WHEN** a viewer requests a profile for an existing username
- **THEN** the system returns display name, bio, avatar URL, follower/following counts, and join date without exposing private data

#### Scenario: View non-existent profile
- **WHEN** a viewer requests a profile for a username that does not exist
- **THEN** the system returns a not-found error

### Requirement: Avatar handling via Cloudinary URL
The system SHALL store avatar as a Cloudinary secure URL and SHALL validate URL format on save.

#### Scenario: Avatar URL saved
- **WHEN** a user saves a valid Cloudinary secure URL as avatar
- **THEN** the system stores it and serves it in profile responses

#### Scenario: Invalid avatar URL rejected
- **WHEN** a user submits a non-URL or non-Cloudinary URL where strict mode is enabled
- **THEN** the system rejects with a validation error
