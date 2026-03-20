# ADR-002: Authentication and Session Management
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

BrainDump is a multi-user public web application where users store personal knowledge. Authentication must cover registration (REQ-001), login/logout (REQ-002), and password reset via email (REQ-003). The system must prevent user enumeration on the password reset flow. Sessions must survive server restarts (data durability concern). The application is a monolithic server with a React SPA frontend.

**Driver:** Security, Auth/Identity
**Door type:** One-way -- auth architecture is woven into every protected route; changing the mechanism later affects the entire application

## Trade-off Analysis

### Session Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Server-side sessions (express-session + PostgreSQL store) | Simple, server controls session lifecycle, survives restart via DB store, easy to invalidate (delete row) | Requires session store infrastructure, every request hits the store | Session store becomes bottleneck at scale (not a concern at <50 concurrent users) | HIGH -- session handling is in every middleware and route |
| JWT (stateless tokens) | No server-side session store, horizontally scalable | Cannot easily invalidate tokens (need blacklist = back to server state), token size in every request, XSS risk if stored in localStorage, complexity for a monolith | Premature optimization for horizontal scaling that is not needed; harder to implement secure logout | HIGH -- token handling is in every middleware and route |
| JWT with refresh tokens | Adds revocability via short-lived access tokens + server-side refresh token store | Complexity of two-token flow, still needs server-side store for refresh tokens (negating JWT's stateless benefit) | Over-engineered for a monolith with a single database | HIGH |

**Recommendation:** Server-side sessions with PostgreSQL store
**Because:** BrainDump is a monolith that already depends on PostgreSQL. Server-side sessions stored in PostgreSQL survive restarts (durability), can be invalidated instantly on logout or account deletion (security), and add no new infrastructure. JWT's scaling benefit is irrelevant for a single-server deployment.

### Password Hashing

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| bcrypt | Adaptive cost factor, industry standard, resistant to GPU attacks, well-audited | Slower than non-adaptive hashes (by design) | None -- bcrypt is the established standard | LOW -- swap hashing library, rehash on next login |
| Argon2 | Newer, memory-hard (better GPU resistance), winner of Password Hashing Competition | Smaller ecosystem in Node.js, native compilation dependency | Native dependency may complicate CI/deployment | LOW -- swap hashing library, rehash on next login |
| scrypt | Memory-hard, built into Node.js crypto module | Less commonly used for password hashing, fewer best-practice references | Fewer community resources for correct configuration | LOW |

**Recommendation:** bcrypt (via `bcryptjs` -- pure JS implementation)
**Because:** Industry standard with well-understood security properties. The pure JavaScript implementation (`bcryptjs`) avoids native compilation dependencies, simplifying CI and deployment. Cost factor 12 provides adequate security for current hardware. This is a two-way door -- if Argon2 becomes necessary, passwords are rehashed on next successful login.

### Password Reset Flow

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Signed token via email (crypto.randomBytes) | Simple, stateless token, no additional DB table needed if token is self-contained (signed with expiry) | Token in email URL is visible in logs, email delivery is external dependency | Token leakage if email is compromised (standard risk, mitigated by expiry) | LOW -- change token generation mechanism |
| DB-stored reset token | Can track usage, revoke tokens explicitly, audit trail | Additional DB table or column, cleanup of expired tokens | Slightly more complexity | LOW |

**Recommendation:** DB-stored reset token
**Because:** Allows explicit token revocation (used tokens are deleted), prevents token reuse, and provides an audit trail. The `password_reset_tokens` table is small and simple. Tokens expire after 1 hour. The same success message is returned regardless of whether the email exists (preventing user enumeration per REQ-003).

## Decision

1. **Sessions:** `express-session` with `connect-pg-simple` as the store. Session cookie is `httpOnly`, `secure` (in production), `sameSite: strict`. Session lifetime: 7 days with rolling expiry (refreshed on activity).

2. **Password hashing:** `bcryptjs` with cost factor 12. Passwords are hashed on registration and password reset. Plaintext passwords are never stored or logged.

3. **Password reset:** A `password_reset_tokens` table stores `(token_hash, user_id, expires_at, created_at)`. The raw token is sent via email; only the hash is stored. Tokens expire after 1 hour. On successful reset, the token row is deleted and all existing sessions for that user are invalidated.

4. **Registration:** Email uniqueness enforced by database UNIQUE constraint. Username stored for display purposes. Password minimum length: 8 characters (server-side validation).

5. **Session invalidation on account deletion:** When a user deletes their account (REQ-014), all their sessions are deleted from the session store as part of the CASCADE delete on user_id.

## Email Integration Boundary

The application defines an `emailService` interface with a single method: `sendPasswordResetEmail(to, resetUrl)`. In development, this logs to console. In production, it delegates to an external transactional email provider configured via environment variables (`EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`). The application does not implement SMTP -- it calls an HTTP API.

Supported providers for v1: SendGrid or any provider with a simple HTTP send API. The provider is a configuration choice, not an architectural decision.

## Fitness Functions

**Dev:**
- Test suite asserts: protected routes return 401 without a valid session
- Test suite asserts: login with wrong password returns 401 (not 500)
- Test suite asserts: password reset response is identical for registered and unregistered emails (no user enumeration)
- Test suite asserts: expired reset tokens are rejected
- Test suite asserts: after logout, session cookie is invalidated and protected routes return 401

**Prod:**
- Monitor 401 response rate -- Warning: spike > 5x baseline over 5-minute window | Critical: any 200 response on a protected route without a valid session (indicates auth bypass)
- Monitor password reset request rate -- Warning: > 10 requests per minute from same IP (potential enumeration attempt)
- Session table row count -- informational metric for capacity planning

## Consequences

- Every authenticated route uses `req.session.userId` -- this is the identity anchor for the entire application
- Session store adds one PostgreSQL table (`sessions`) managed by `connect-pg-simple` -- the schema is provided by the library
- Password reset requires an email provider in production -- this is an external dependency the deployment must satisfy
- The `httpOnly` + `secure` + `sameSite: strict` cookie configuration prevents XSS-based session theft and CSRF attacks
- bcryptjs is pure JavaScript -- slower than native bcrypt but eliminates build dependencies; acceptable for BrainDump's user volume
