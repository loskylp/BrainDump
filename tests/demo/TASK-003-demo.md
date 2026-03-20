# Demo Script -- TASK-003: User Registration
**Task:** TASK-003 -- User registration
**Requirement:** REQ-001
**Date:** 2026-03-20
**Environment:** Local development (`http://localhost:5173`) or staging (`https://braindump.staging.nxlabs.cc`)

Start with a fresh browser session (no existing cookies). The database must have migrations applied through `20260319000007-create-sessions.js`.

---

## Scenario 1 -- Valid registration creates an account and starts a session

AC-1, AC-2, AC-5 (REQ-001)

Given   An unauthenticated visitor at the registration page
When    The visitor navigates to `/register`
Then    The registration form is displayed with fields for username, email, and password

Given   The registration form is displayed
When    The visitor enters username `demotester`, email `demotester@example.com`, and password `SecurePass1`
And     The visitor submits the form
Then    The server returns 201 and the browser navigates to `/workspace`
And     A session cookie (`connect.sid`) is present in the browser with `HttpOnly` and `SameSite=Strict` attributes

Verification step: open browser DevTools > Application > Cookies and confirm `connect.sid` is set.

---

## Scenario 2 -- Duplicate email is rejected with a clear error

AC-3 (REQ-001)

Given   An account already exists for `demotester@example.com` (from Scenario 1)
When    A new visitor submits the registration form with email `demotester@example.com` and a different username
Then    The server returns 409 and an error message indicating the email is already taken is displayed
And     No new account is created
And     No session cookie is set for this failed attempt

---

## Scenario 3 -- Short password is rejected server-side

AC-4 (REQ-001)

Given   The registration form is displayed
When    The visitor enters a valid username, valid email, and a 7-character password (e.g., `Short12`)
Then    The server returns 400 with a validation error
And     No account is created

Boundary check: submit again with exactly 8 characters (e.g., `Short123`). The server must return 201.

---

## Scenario 4 -- Client-side validation prevents premature submission

AC-6 (REQ-001)

Given   The registration form is displayed
When    The visitor leaves the username field empty and attempts to submit
Then    The form displays a client-side validation error before making any network request
And     No request is sent to `POST /api/auth/register`

Given   The visitor enters a username but provides a malformed email (e.g., `notanemail`)
When    The visitor attempts to submit
Then    The form displays an email format error and does not submit

Given   The visitor enters a username and valid email but a 7-character password
When    The visitor attempts to submit
Then    The form displays a password length error and does not submit

Verification step: open browser DevTools > Network and confirm no `POST /api/auth/register` request appears during any of the three invalid submission attempts above.

---

## Scenario 5 -- Password is not stored in plaintext

AC-2 (REQ-001)

Given   A user account was created in Scenario 1
When    The `users` table row for `demotester@example.com` is inspected directly in the database
Then    The `password_hash` column contains a bcrypt hash starting with `$2b$12$` (cost factor 12)
And     The column does not contain the plaintext value `SecurePass1`

Database query (run from `backend/` directory):
```
POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
psql $POSTGRES_URL -c "SELECT username, email, LEFT(password_hash, 10) AS hash_prefix FROM users WHERE email = 'demotester@example.com';"
```

Expected output: `hash_prefix` begins with `$2b$12$`.
