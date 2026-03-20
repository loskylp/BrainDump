# Demo Script -- TASK-004: User Login and Logout
**Task:** TASK-004 -- User login and logout
**Requirement:** REQ-002
**Date:** 2026-03-20
**Environment:** Local development (`http://localhost:5173`) or staging (`https://braindump.staging.nxlabs.cc`)

Start with an existing account. If none exists, complete the TASK-003 demo first to register `demotester@example.com` with password `SecurePass1`. The database must have migrations applied through `20260319000007-create-sessions.js`.

---

## Scenario 1 -- Registered user logs in and receives a session cookie

AC-1, AC-2 (REQ-002)

Given   An unauthenticated visitor with an existing account (`demotester@example.com`, password `SecurePass1`)
When    The visitor navigates to `/login`, enters their credentials, and submits
Then    The server returns 200 with the user object (`{ user: { id, username, email } }`)
And     The browser navigates to `/workspace`
And     A session cookie named `connect.sid` is present with `HttpOnly` and `SameSite=Strict` attributes

Verification step: open browser DevTools > Application > Cookies. Confirm `connect.sid` is present and shows `HttpOnly` checked and `SameSite` set to `Strict`. Confirm the `Expires` column shows a date approximately 7 days in the future.

---

## Scenario 2 -- Invalid credentials are rejected without revealing which field was wrong

AC-3 (REQ-002, FF-D04)

Given   The login form is displayed
When    The visitor enters a valid email but an incorrect password (e.g., `WrongPass1`) and submits
Then    The server returns 401 and an error message is shown
And     No session cookie is set

Given   The login form is displayed
When    The visitor enters an email address that has never been registered (e.g., `nobody@example.com`) and any password
Then    The server returns 401 with an error message that is identical to the wrong-password message
And     The error does not mention whether the email or the password was the cause

Negative check: the two 401 error messages must be word-for-word identical. If they differ (e.g., "Wrong password" vs "User not found"), this is a user-enumeration defect.

---

## Scenario 3 -- Authenticated user can log out and the session is invalidated

AC-4, AC-5 (REQ-002, FF-D07)

Given   The visitor is logged in (session cookie present from Scenario 1)
When    The visitor clicks the logout button in the workspace
Then    The server returns 200 and the browser navigates to `/login`
And     The session row is deleted from the PostgreSQL sessions table

Post-logout check: navigate directly to `/workspace` (or call `GET /api/auth/me` via DevTools). Confirm the server returns 401 and the browser is redirected to `/login`. This confirms the old session cookie is no longer accepted.

Database confirmation (optional):
```
POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
psql $POSTGRES_URL -c "SELECT COUNT(*) FROM session;"
```
Expected: 0 rows (or fewer rows than before logout -- the session row has been removed).

---

## Scenario 4 -- Session persists across requests and survives a page reload

AC-2 (REQ-002)

Given   The visitor is logged in and on the workspace page
When    The visitor reloads the page (F5 or Cmd+R)
Then    The workspace is still shown (not redirected to login)
And     `GET /api/auth/me` (observable in DevTools > Network) returns 200 with the user object

This confirms the session cookie is being sent and the server-side session in PostgreSQL is valid.

---

## Scenario 5 -- Session lifetime is 7 days with rolling expiry

AC-6 (REQ-002)

Given   The visitor just logged in
When    The `connect.sid` cookie is inspected in browser DevTools > Application > Cookies
Then    The `Expires` field shows a date approximately 7 days from now (within a few minutes of `login time + 7 days`)

Note: express-session refreshes the `Expires` timestamp on each request when `rolling: true` is configured. After any authenticated request, the expiry should reset to 7 days from that request's timestamp.

---

## Scenario 6 -- Re-login after logout creates a fresh session

AC-1, AC-4 (REQ-002)

Given   The visitor has just logged out (Scenario 3)
When    The visitor logs in again with the same credentials (`demotester@example.com`, `SecurePass1`)
Then    The server returns 200 and a new `connect.sid` cookie is set
And     The cookie value is different from the pre-logout cookie value (a new session was created)
And     The browser navigates to `/workspace` successfully
