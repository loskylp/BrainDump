# Routing Instruction -- Builder
**Task:** TASK-015 | **Iteration:** 1 of 3
**Date:** 2026-03-21 | **From:** Orchestrator | **To:** Builder

---

## Context

TASK-015 implements the password reset flow (REQ-003, ADR-002). This is the third and final P1 Must Have feature in Cycle 2. Without password reset, users who forget their password are permanently locked out -- critical for a public service where users rely on persistent data.

The infrastructure is already in place from Cycle 1:
- The `password_reset_tokens` table exists (migration `20260319000005-create-password-reset-tokens.js`) with columns: `id`, `user_id`, `token_hash`, `expires_at`, `created_at`
- The auth routes file (`backend/src/routes/auth.js`) has stubs for `POST /forgot-password` and `POST /reset-password`
- The `emailService.js` has a full contract stub (`backend/src/services/emailService.js`)
- Frontend API stubs exist in `frontend/src/api/auth.js` for `forgotPassword(email)` and `resetPassword(token, newPassword)`

The Scaffolder has prepared these stubs:
- `frontend/src/components/auth/ForgotPasswordForm.jsx` -- form component stub
- `frontend/src/components/auth/ResetPasswordForm.jsx` -- form component stub
- `frontend/src/pages/ForgotPasswordPage.jsx` -- page stub
- `frontend/src/pages/ResetPasswordPage.jsx` -- page stub
- `frontend/src/App.jsx` has commented-out imports and route entries for `/forgot-password` and `/reset-password`

The "Forgot password?" link already exists on the login page. Wire it to the `/forgot-password` route.

## What to Build

### Backend

#### Step 1: Implement `backend/src/services/emailService.js`

Replace the stub with a working `sendPasswordResetEmail(to, resetUrl)` function:

1. Check `process.env.NODE_ENV`:
   - In development/staging/test (`NODE_ENV !== 'production'`): log the reset URL to console with a clear label (e.g., `[EMAIL] Password reset link for ${to}: ${resetUrl}`). Return successfully.
   - In production (`NODE_ENV === 'production'`): delegate to the configured email provider. For now, log to console as well (production email provider is not yet configured -- this is acceptable per ADR-002 which notes the email integration boundary).

2. The function should be `async` and return a resolved promise on success.
3. On failure, throw an Error with message `'EMAIL_SEND_FAILED'`.

#### Step 2: Implement `POST /api/auth/forgot-password` in `backend/src/routes/auth.js`

Replace the stub handler:

1. Read `req.body.email` -- if missing or empty, return 400 with `{ error: 'Email is required' }`
2. Look up the user by email. **Regardless of whether the user exists:**
   - Return 200 with `{ message: 'If an account with that email exists, a password reset link has been sent.' }`
3. If the user exists:
   - Generate a secure random token: `crypto.randomBytes(32).toString('hex')`
   - Hash the token: `crypto.createHash('sha256').update(token).digest('hex')`
   - Store in `password_reset_tokens` table: `{ user_id, token_hash, expires_at: NOW + 1 hour }`
   - Delete any existing reset tokens for this user first (one active token per user)
   - Build the reset URL: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`
   - Call `emailService.sendPasswordResetEmail(email, resetUrl)`
4. **Timing safety:** The response must take approximately the same time whether the email is registered or not. Do not short-circuit and return early for unregistered emails -- always perform the lookup, then respond.

#### Step 3: Implement `POST /api/auth/reset-password` in `backend/src/routes/auth.js`

Replace the stub handler:

1. Read `req.body.token` and `req.body.password` -- if either is missing, return 400
2. Hash the incoming token: `crypto.createHash('sha256').update(token).digest('hex')`
3. Look up the token in `password_reset_tokens` by `token_hash`
4. Validate:
   - Token exists -- if not, return 400 with `{ error: 'Invalid or expired reset token' }`
   - Token not expired (`expires_at > NOW`) -- if expired, return 400 with `{ error: 'Invalid or expired reset token' }`
5. On valid token:
   - Hash the new password with bcrypt (same cost factor as registration -- 12)
   - Update `users.password_hash` for the token's `user_id`
   - Delete the token row from `password_reset_tokens` (invalidate)
   - Destroy all sessions for that user: delete from the `session` table where `sess->>'userId' = user_id` (or equivalent -- the session store uses `connect-pg-simple` which stores session data as JSON in the `sess` column)
   - Return 200 with `{ message: 'Password has been reset successfully' }`
6. Password validation: minimum 8 characters (same rule as registration). Return 400 if too short.

#### Step 4: Create a PasswordResetToken model or use raw queries

Either approach is acceptable:
- **Option A:** Create a Sequelize model `PasswordResetToken` in `backend/src/models/PasswordResetToken.js` and register it in `models/index.js`
- **Option B:** Use `sequelize.query()` with bind parameters for the token CRUD operations

The token table already has columns: `id` (UUID, PK), `user_id` (UUID, FK to users), `token_hash` (VARCHAR(64), unique), `expires_at` (TIMESTAMP WITH TIME ZONE), `created_at` (TIMESTAMP WITH TIME ZONE, default NOW).

### Frontend

#### Step 5: Implement `frontend/src/api/auth.js` -- forgotPassword and resetPassword

Replace the stubs:
- `forgotPassword(email)`: POST to `/api/auth/forgot-password` with `{ email }`; return the response JSON
- `resetPassword(token, newPassword)`: POST to `/api/auth/reset-password` with `{ token, password: newPassword }`; return the response JSON

#### Step 6: Implement `frontend/src/components/auth/ForgotPasswordForm.jsx`

Replace the stub:
- Local state: `email` (string), `isLoading` (boolean), `error` (string|null), `success` (boolean)
- On submit: call `forgotPassword(email)` from api/auth.js
- On success: show the success message from the API response (always the same message, regardless of email existence)
- On error: show the error message
- Client-side validation: require non-empty email with basic format check
- Style consistently with `LoginForm` and `RegisterForm` (same card layout, same ADR-008 tokens)

#### Step 7: Implement `frontend/src/components/auth/ResetPasswordForm.jsx`

Replace the stub:
- Read the reset token from URL query params via `useSearchParams()`
- Local state: `password` (string), `confirmPassword` (string), `isLoading` (boolean), `error` (string|null), `success` (boolean)
- Client-side validation: password >= 8 characters, password matches confirmPassword
- On submit: call `resetPassword(token, password)` from api/auth.js
- On success: show success message with a link to `/login`
- On error: show the error message (e.g., "Invalid or expired reset token")
- If no token in URL: show an error state with a link to `/forgot-password`

#### Step 8: Implement `frontend/src/pages/ForgotPasswordPage.jsx`

Replace the stub:
- Render `ForgotPasswordForm` in a centered card layout consistent with `LoginPage`
- Include a footer link: "Back to Login" linking to `/login`
- Public page (no auth guard)

#### Step 9: Implement `frontend/src/pages/ResetPasswordPage.jsx`

Replace the stub:
- Render `ResetPasswordForm` in a centered card layout consistent with `LoginPage`
- If no `?token=` param present: render error state with link to `/forgot-password`
- Public page (no auth guard)

#### Step 10: Wire routes in `frontend/src/App.jsx`

- Uncomment the imports for `ForgotPasswordPage` and `ResetPasswordPage`
- Uncomment the `<Route>` entries for `/forgot-password` and `/reset-password`
- Both are public routes (no `ProtectedRoute` wrapper)

#### Step 11: Wire the "Forgot password?" link on the login page

- The link already exists on the login page. Ensure it navigates to `/forgot-password` (it may already be wired -- verify and connect if needed).

### Tests

#### Step 12: Backend tests

**Unit tests** (`backend/tests/unit/emailService.test.js`):
- `sendPasswordResetEmail` logs to console in non-production environments
- `sendPasswordResetEmail` resolves without throwing

**Integration/acceptance tests** (`backend/tests/acceptance/TASK-015-password-reset.test.js`):
- AC-1: POST `/api/auth/forgot-password` with a registered email returns 200 and creates a token row in `password_reset_tokens`
- AC-2: The token stored in DB is hashed (not the raw token); raw token is different from stored hash
- AC-3: POST `/api/auth/forgot-password` with an unregistered email returns 200 with the same success message (no user enumeration)
- AC-4: Verify emailService is called with the correct email and a reset URL containing the raw token
- AC-5: POST `/api/auth/reset-password` with valid token and new password returns 200; user can log in with new password
- AC-6: After successful reset, the token row is deleted from `password_reset_tokens`
- AC-7: After successful reset, all existing sessions for the user are invalidated (verify session count is 0 or sessions are destroyed)
- AC-8: POST `/api/auth/reset-password` with an expired token (> 1 hour) returns 400 with appropriate error
- AC-9: POST `/api/auth/reset-password` with a previously used (deleted) token returns 400
- AC-10: Password validation: new password shorter than 8 characters is rejected with 400

#### Step 13: Frontend tests

**Component tests** (`frontend/src/__tests__/ForgotPasswordForm.test.jsx`):
- Renders email input and submit button
- Shows loading state during submission
- Shows success message after successful submission
- Shows error message on API failure
- Validates email is required before submission

**Component tests** (`frontend/src/__tests__/ResetPasswordForm.test.jsx`):
- Renders password and confirm password inputs
- Validates password minimum length
- Validates password confirmation match
- Shows success message with login link after successful reset
- Shows error message on API failure (e.g., expired token)
- Shows error state when no token is in URL

## Acceptance Criteria (from Task Plan)

1. A user can request a password reset by entering their email at `/forgot-password`
2. A `password_reset_tokens` row is created with `(token_hash, user_id, expires_at)`. Raw token is sent via email; only the hash is stored
3. The same success message is shown regardless of whether the email is registered (no user enumeration)
4. The `emailService` interface calls `sendPasswordResetEmail(to, resetUrl)`. In development, this logs to console. In production, it delegates to a configured provider
5. A user with a valid reset link can set a new password; the password is re-hashed with bcrypt
6. On successful reset, the token row is deleted and all existing sessions for that user are invalidated
7. Expired reset tokens (> 1 hour) are rejected with a prompt to request a new link
8. Used tokens cannot be reused

## Files to Touch

| File | Action |
|---|---|
| `backend/src/services/emailService.js` | Implement (replace stub) |
| `backend/src/routes/auth.js` | Implement forgot-password and reset-password stubs |
| `backend/src/models/PasswordResetToken.js` | Create (optional -- may use raw queries instead) |
| `backend/src/models/index.js` | Modify (register PasswordResetToken model if created) |
| `frontend/src/api/auth.js` | Implement forgotPassword and resetPassword stubs |
| `frontend/src/components/auth/ForgotPasswordForm.jsx` | Implement (replace stub) |
| `frontend/src/components/auth/ResetPasswordForm.jsx` | Implement (replace stub) |
| `frontend/src/pages/ForgotPasswordPage.jsx` | Implement (replace stub) |
| `frontend/src/pages/ResetPasswordPage.jsx` | Implement (replace stub) |
| `frontend/src/App.jsx` | Modify (uncomment imports and routes) |
| `backend/tests/unit/emailService.test.js` | Create |
| `backend/tests/acceptance/TASK-015-password-reset.test.js` | Create |
| `frontend/src/__tests__/ForgotPasswordForm.test.jsx` | Create |
| `frontend/src/__tests__/ResetPasswordForm.test.jsx` | Create |

## Constraints

- Do NOT create new migrations -- the `password_reset_tokens` table already exists from `20260319000005`
- Use `crypto.randomBytes(32)` for token generation -- do not use UUIDs or weaker random sources
- Store only the SHA-256 hash of the token in the database -- never store the raw token
- The forgot-password endpoint MUST return 200 for both registered and unregistered emails (timing-safe, no user enumeration)
- Password hashing: use bcrypt with cost factor 12 (same as registration in authService)
- Session invalidation on reset: destroy all sessions for the user, not just the current one
- Token expiry: exactly 1 hour from creation
- Use bind parameters in all SQL queries -- never interpolate user input
- Style frontend components consistently with existing auth pages (LoginPage, RegisterPage) using ADR-008 design tokens

## Commit Convention

Commit message: `TASK-015: Password reset flow -- [summary of what was done]`

Push to `main` branch after committing.

## Handoff

After completing implementation and tests, provide:
1. What was built (files changed/created)
2. Test results (all tests passing, count)
3. Any deviations from this routing instruction
4. Any observations or concerns
