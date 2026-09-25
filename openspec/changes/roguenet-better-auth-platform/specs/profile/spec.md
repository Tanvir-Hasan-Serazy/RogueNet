## Purpose

Extends the better-auth user with social profile fields and public profile views so every identity has a discoverable presence atop trusted auth.

## ADDED Requirements

### Requirement: Profile extension atop better-auth user
The system SHALL store profile fields (unique username, display name, bio, avatar URL) linked to the better-auth `user.id` via additionalFields or a FK profile table, and SHALL allow the authenticated owner to edit them.

#### Scenario: User sets username after sign-up
- **WHEN** an authenticated user (via better-auth session) sets a valid unique username and display name
- **THEN** the system persists the profile extension linked to `user.id` and returns the updated profile

#### Scenario: Username uniqueness enforced
- **WHEN** a user attempts to set a username already taken by another better-auth user
- **THEN** the system rejects with a conflict error and does not modify the profile

#### Scenario: Unauthenticated profile edit rejected
- **WHEN** a request without a valid better-auth session attempts to edit a profile
- **THEN** the system returns 401

### Requirement: Public profile viewing
The system SHALL allow any viewer (authenticated via better-auth or anonymous) to fetch a user's public profile by username, exposing only public fields.

#### Scenario: View existing profile
- **WHEN** a viewer requests a profile for an existing username
- **THEN** the system returns display name (alias of username per product decision), bio, avatar URL, follower/following counts, and join date without exposing email or private fields

#### Scenario: View non-existent profile
- **WHEN** a viewer requests a profile for a username that does not exist
- **THEN** the system returns a not-found error

### Requirement: Owner-conditional private fields (single conditional endpoint)
The system SHALL use a single conditional endpoint `GET /api/profiles/:username` with optional `better-auth` session (`viewerId?: string | null` via `auth.api.getSession` + `fromNodeHeaders`). The system SHALL return private fields (`email`, `dob`, `emailVerified`) and `isOwner:true` only when `viewerId === user.id`; otherwise it SHALL return only public fields with `isOwner:false`.

#### Scenario: Owner views own profile
- **WHEN** an authenticated viewer whose `session.user.id` equals the profile `user.id` requests `GET /api/profiles/:username`
- **THEN** the system returns public fields plus `email`, `dob`, `emailVerified`, and `isOwner:true`

#### Scenario: Stranger or anonymous views profile
- **WHEN** an anonymous viewer or an authenticated viewer with `viewerId !== user.id` requests `GET /api/profiles/:username`
- **THEN** the system returns only public fields with `isOwner:false` and MUST NOT expose `email`, `dob`, or other private fields

### Requirement: Avatar handling via Cloudinary URL
The system SHALL store avatar as a Cloudinary secure URL and SHALL validate URL format on save.

#### Scenario: Avatar URL saved
- **WHEN** an authenticated user saves a valid Cloudinary secure URL as avatar
- **THEN** the system stores it and serves it in profile responses

#### Scenario: Invalid avatar URL rejected
- **WHEN** a user submits a non-URL for avatar where validation is enabled
- **THEN** the system rejects with a validation error
