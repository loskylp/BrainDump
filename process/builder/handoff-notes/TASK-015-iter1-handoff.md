# Builder Handoff Note — TASK-015 Iteration 1

**Task:** TASK-015 — Password reset flow
**Date:** 2026-03-21
**Builder iteration:** 1 of 3
**Status:** Complete — all tests pass, committed, pushed to main

---

## What Was Built

### Backend

**`backend/src/services/emailService.js`** — Implemented `sendPasswordResetEmail(to, resetUrl)`:
- Logs `[EMAIL] Password reset link for ${to}: ${resetUrl}` to `console.log`
- Async function that resolves `undefined` on success
- Console logging applies in all environments (production email provider deferred per ADR-002)

**`backend/src/services/authService.js`** — Implemented `forgotPassword(email)` and `resetPassword(token, newPassword)`:
- `forgotPassword`: looks up user by email, deletes any existing tokens for that user, inserts a new token row with SHA-256 hash of `crypto.randomBytes(32)` raw token, builds reset URL, calls `emailService.sendPasswordResetEmail`. Returns `undefined` for both registered and unregistered emails (no user enumeration, ADR-002). Token expires 1 hour from creation.
- `resetPassword`: validates password length (>= 8), hashes incoming token with SHA-256, queries `password_reset_tokens WHERE token_hash = :hash AND expires_at > NOW()`, updates user's `password_hash` with bcrypt cost 12, deletes the token row, destroys all sessions via `DELETE FROM session WHERE sess->>'userId' = :userId`.

**`backend/src/routes/auth.js`** — Implemented stubs for:
- `POST /api/auth/forgot-password`: validates email present, delegates to `authService.forgotPassword`, always returns 200 with same message.
- `POST /api/auth/reset-password`: validates token and password present, delegates to `authService.resetPassword`, returns 200 on success. Error codes (`INVALID_TOKEN`, `VALIDATION_ERROR`) are mapped to 400 by the existing error handler in `app.js`.

### Frontend

**`frontend/src/api/auth.js`** — Implemented:
- `forgotPassword(email)`: `POST /api/auth/forgot-password` with `{ email }`
- `resetPassword(token, newPassword)`: `POST /api/auth/reset-password` with `{ token, password: newPassword }`

**`frontend/src/components/auth/ForgotPasswordForm.jsx`** — Full implementation:
- Email input with required validation, submit button
- States: idle / loading / success / error
- On success: hides form, shows "Check your email for a reset link" message
- On error: shows error alert with API error message

**`frontend/src/components/auth/ResetPasswordForm.jsx`** — Full implementation:
- Reads token from URL via `useSearchParams()`
- If token missing: renders error state with link to `/forgot-password`
- Password + confirm password inputs with client-side validation (min 8 chars, must match)
- On success: shows success message with link to `/login`
- On API error: shows error alert

**`frontend/src/pages/ForgotPasswordPage.jsx`** — Centered card layout matching LoginPage, renders ForgotPasswordForm, footer link to `/login`.

**`frontend/src/pages/ResetPasswordPage.jsx`** — Centered card layout, renders ResetPasswordForm (missing-token error state handled inside form component).

**`frontend/src/App.jsx`** — Uncommented imports and routes for `/forgot-password` and `/reset-password`.

### Tests

| File | Tests | Result |
|---|---|---|
| `backend/tests/unit/emailService.test.js` | 4 | PASS |
| `backend/tests/unit/passwordReset.test.js` | 12 | PASS |
| `frontend/src/__tests__/ForgotPasswordForm.test.jsx` | 6 | PASS |
| `frontend/src/__tests__/ResetPasswordForm.test.jsx` | 10 | PASS |

Backend unit total: 244 pass (up from 217; zero regressions)
Frontend total: 318 pass (up from 302; zero regressions)

---

## Deviations from Routing Instruction

1. **`backend/src/models/PasswordResetToken.js`** — Not created. Raw Sequelize queries are used instead (Option B from the routing instruction). The migration table schema was confirmed via the existing migration file. No model registration in `models/index.js` was needed.

2. **emailService function name** — The existing stub exported `sendPasswordReset(to, resetUrl)`. The routing instruction summary refers to `sendPasswordResetEmail(email, token)`. The routing instruction body (Step 1, Step 4) uses `sendPasswordResetEmail(email, resetUrl)` where `resetUrl` is the full URL. The implementation exports `sendPasswordResetEmail(to, resetUrl)` to match the body of the routing instruction and the Scaffolder's documented contract in the stub. The old export name `sendPasswordReset` was replaced entirely.

3. **`forgotPassword` authService signature** — The route calls `authService.forgotPassword(email)` without passing `appUrl`. The `frontendUrl` parameter defaults to `process.env.FRONTEND_URL || 'http://localhost:5173'` inside the service, which is the correct behavior.

4. **Route body field name** — The `reset-password` route accepts `password` in the body (not `newPassword`). The frontend `resetPassword(token, newPassword)` API function sends `{ token, password: newPassword }`, mapping the frontend naming to the backend naming at the API boundary.

5. **TASK-015 acceptance tests** — The routing instruction specifies an acceptance test file at `backend/tests/acceptance/TASK-015-password-reset.test.js`. Acceptance tests are the Verifier's domain (Builder scope boundary). The unit tests I wrote cover the route and service contract at the unit level. The Verifier should create the acceptance tests using a live database.

---

## Observations

- The session deletion SQL `DELETE FROM session WHERE sess->>'userId' = :userId` matches the connect-pg-simple schema where session data is stored as JSON in the `sess` column. This is the correct approach for full session invalidation on password reset.
- The "Forgot password?" link on LoginPage already calls `onForgotPassword` which navigates to `/forgot-password` — no changes were needed there.
- Acceptance/integration tests (13 suites) continue to fail with `POSTGRES_URL environment variable is required` — this was pre-existing and unrelated to TASK-015.
