# Auth Specification

## Purpose
Provides complete authentication and session management via better-auth so all social features operate on a trusted, verified identity.

## Requirements

### Requirement: Sign-up and sign-in via better-auth
The system SHALL use better-auth for email/password sign-up and sign-in, creating a user and session managed by better-auth's adapter tables, and SHALL reject invalid credentials.

#### Scenario: Successful sign-up
- **WHEN** a new user signs up via better-auth with a valid email and password meeting policy
- **THEN** the system creates the user via the better-auth adapter, creates a session cookie, and returns the user and session

#### Scenario: Successful sign-in
- **WHEN** an existing user signs in with correct email and password
- **THEN** the system validates via better-auth, creates a new session, and sets the session cookie

#### Scenario: Invalid credentials rejected
- **WHEN** a user signs in with an incorrect password
- **THEN** the system returns an authentication error and does not create a session

### Requirement: Session management and route protection
The system SHALL maintain sessions via better-auth (cookie-based, httpOnly, sameSite lax, secure in production), SHALL expose current session via `getSession`, and SHALL protect all authenticated routes by validating the better-auth session.

#### Scenario: Authenticated request succeeds
- **WHEN** a client sends a request with a valid better-auth session cookie and calls a protected endpoint
- **THEN** the system resolves the session via `auth.api.getSession`, attaches `user.id`, and processes the request

#### Scenario: Unauthenticated request rejected
- **WHEN** a client without a valid session calls a protected endpoint
- **THEN** the system returns 401 and does not process the request

#### Scenario: Sign-out clears session
- **WHEN** an authenticated user signs out via better-auth
- **THEN** the system invalidates the session in the adapter and clears the cookie so subsequent protected requests return 401

### Requirement: Email verification and password reset
The system SHALL support email verification and password reset via better-auth's verification flow, and SHALL enforce verification policy where configured.

#### Scenario: Verification email sent on sign-up
- **WHEN** a user signs up with email verification enabled
- **THEN** the system creates a verification token via better-auth and sends a verification email

#### Scenario: Password reset via verification token
- **WHEN** a user requests password reset and then submits a valid token with a new password
- **THEN** the system updates the password via better-auth and invalidates old sessions as configured

### Requirement: WebSocket authentication via better-auth session
The system SHALL authenticate WebSocket handshakes by validating the better-auth session cookie/token via `auth.api.getSession`, and SHALL reject unauthenticated sockets.

#### Scenario: WebSocket connects with valid session
- **WHEN** a client opens a WebSocket with a valid better-auth session cookie
- **THEN** the server validates the session, attaches `userId` to the socket, and allows multiplexed events

#### Scenario: WebSocket rejected without session
- **WHEN** a client opens a WebSocket without a valid session
- **THEN** the server rejects the handshake with an authentication error

### Requirement: OAuth and adapter integrity
The system SHALL use the better-auth Prisma or Drizzle adapter as the source of truth for `user`, `session`, `account`, and `verification` tables, and SHALL support optional OAuth providers via better-auth configuration.

#### Scenario: OAuth sign-in creates linked account
- **WHEN** a user signs in via a configured OAuth provider (e.g., GitHub) through better-auth
- **THEN** the system creates or links the `account` record to the user and establishes a session

#### Scenario: Adapter tables are source of truth
- **WHEN** any app code needs the current user identity
- **THEN** it SHALL read `session.user.id` from better-auth and never maintain a parallel user/session table
