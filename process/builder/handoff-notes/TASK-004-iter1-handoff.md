# Handoff Note — TASK-004: User Login and Logout (Iteration 1)
**Builder:** Claude Sonnet 4.6
**Date:** 2026-03-20
**Status:** Implementation complete — pending Verifier sign-off

---

## Summary

Implemented login and logout for TASK-004 (REQ-002, ADR-002). All 6 acceptance criteria are addressed by the production code and unit tests. The frontend now has a functional login page, working session checks on mount, and a logout button in the workspace sidebar. The session infrastructure (express-session + connect-pg-simple, 7-day rolling, HttpOnly+SameSite=Strict cookie) was already in place from TASK-003.

---

## What Was Built

### Backend

**`backend/src/models/User.js`**
- Implemented `User.comparePassword(plaintext)` — delegates to `bcryptjs.compare(plaintext, this.password_hash)`. Returns `false` on mismatch, only throws on bcrypt internal error. The `bcryptjs` require was added to the model file.

**`backend/src/services/authService.js`**
- Implemented `login(email, password)` — normalizes email (trim + lowercase), looks up user, calls `comparePassword`. Both "email not found" and "wrong password" throw `INVALID_CREDENTIALS` with the same message (no enumeration, ADR-002).
- Implemented `logout(session)` — wraps `session.destroy()` in a Promise. Deletes the session row from the PostgreSQL session store.

**`backend/src/routes/auth.js`**
- Implemented `POST /api/auth/login` — calls `authService.login()`, sets `req.session.userId`, returns 200 `{ user: { id, username, email } }`.
- Implemented `POST /api/auth/logout` — calls `authService.logout()`, clears `connect.sid` cookie, returns 200 `{ message: "Logged out" }`.
- Added `GET /api/auth/me` — returns 200 with the authenticated user or 401 if no session. Also handles the edge case of a stale session referencing a deleted user (destroys the session, returns 401). Used by the frontend `useAuth` hook on mount.

### Frontend

**`frontend/src/api/auth.js`**
- Implemented `login(email, password)` — posts to `/api/auth/login`.
- Implemented `logout()` — posts to `/api/auth/logout`.

**`frontend/src/hooks/useAuth.js`**
- Replaced the stub with a real implementation. On mount, calls `GET /api/auth/me` to check session state. Sets `isLoading=true` during the in-flight request. On success sets user; on 401 or any error sets user to null. Exposes `login()` and `logout()` methods that update state and call the auth API.

**`frontend/src/components/auth/LoginForm.jsx`**
- Implemented: email + password fields with client-side validation (non-empty email with valid format, non-empty password). On 401, shows "Invalid email or password" without revealing which field was wrong. On success, calls `props.onSuccess(user)`. "Forgot password?" triggers `props.onForgotPassword`.

**`frontend/src/pages/LoginPage.jsx`**
- Implemented: wraps LoginForm, handles post-login navigation to `/workspace`, and "Forgot password?" navigation to `/forgot-password`. Includes a "Create account" link to `/register`.

**`frontend/src/pages/WorkspacePage.jsx`**
- Added logout button in the sidebar panel area. Calls `useAuth().logout()` and navigates to `/login`. Navigation occurs whether or not the logout API call succeeds (fail-safe: user always lands on login page).

### Tests

**Backend (acceptance tests, require PostgreSQL):**
- `backend/tests/acceptance/TASK-004-login-logout.test.js` — covers all 6 ACs:
  - AC-1/AC-2: successful login returns 200 + session cookie (HttpOnly, SameSite=Strict, Max-Age)
  - AC-2: session persistence verified via `GET /api/auth/me` with session cookie
  - AC-3: invalid credentials return 401; both "wrong password" and "unknown email" return identical error codes
  - AC-4: logout returns 200
  - AC-5: `GET /api/auth/me` returns 401 after logout with old cookie
  - AC-6: session cookie has Max-Age set (7-day rolling expiry is configured in session middleware)
  - `User.comparePassword()` unit tests (requires DB to create a user with hashed password)

**Frontend (no database required):**
- `frontend/src/__tests__/LoginForm.test.jsx` — 9 tests: renders, client-side validation, successful login, API error handling, forgot password callback
- `frontend/src/__tests__/LoginPage.test.jsx` — 3 tests: heading, register link, navigation to /workspace after success
- `frontend/src/__tests__/useAuth.test.jsx` — 6 tests: initial isLoading state, session check success, session check 401, login updates state, logout clears state
- `frontend/src/__tests__/WorkspaceLogout.test.jsx` — 2 tests: logout button renders, logout navigates to /login
- `frontend/src/__tests__/WorkspacePage.test.jsx` — updated (was: 2 tests, still 2 tests) — wrapped in MemoryRouter and mocked useAuth because WorkspacePage now uses useNavigate and useAuth

**Frontend test count: 77 total (58 pre-existing + 19 new), all passing.**

---

## Acceptance Criteria Mapping

| AC | What satisfies it |
|---|---|
| AC-1: Login with valid credentials returns 200 + session cookie | `POST /api/auth/login` route + cookie settings inherited from session middleware |
| AC-2: Session persists across requests (userId in session) | `req.session.userId` set on login; `GET /api/auth/me` verifies persistence |
| AC-3: 401 on invalid credentials, no enumeration | `authService.login()` throws `INVALID_CREDENTIALS` for both wrong-password and unknown-email paths |
| AC-4: Logout destroys session and clears cookie | `authService.logout()` calls `session.destroy()`; route calls `res.clearCookie()` |
| AC-5: Post-logout requests to protected routes return 401 | `GET /api/auth/me` returns 401 after session is destroyed (session store row is gone) |
| AC-6: 7-day rolling session expiry | Session middleware configured with `maxAge: 7 * 24 * 60 * 60 * 1000` and `rolling: true` (TASK-003, unchanged) |

---

## Stubs Left for Future Tasks

- `POST /api/auth/forgot-password` — still a TODO stub (TASK-015)
- `POST /api/auth/reset-password` — still a TODO stub (TASK-015)

---

## Known Limitations and Notes for the Verifier

1. **Backend tests require PostgreSQL.** The TASK-004 acceptance tests are in `backend/tests/acceptance/` and require a live database. They will be skipped/fail without `POSTGRES_URL` set. This is consistent with the project's existing acceptance test structure.

2. **`User.comparePassword()` tests require a seeded user.** The comparePassword tests use `registerUser()` to create a user in the database, then look up the raw model instance. They are in the acceptance test file because they require the real bcrypt hash stored by the registration flow.

3. **`GET /api/auth/me` is a new route not in the original scaffolded list.** This route was required by the `useAuth` hook specification ("calls GET /api/auth/me to check session state"). It was not scaffolded because the hook spec predated the scaffold. The route is correctly scoped to the auth area.

4. **Frontend `App.test.jsx` and `ProtectedRoute.test.jsx` show `act(...)` warnings.** These are pre-existing warnings that now also appear because `useAuth` calls `get('/api/auth/me')` on mount (triggering async state updates in tests that don't mock `get`). The tests still pass. The warnings are cosmetic. The Verifier may observe them.

5. **`WorkspacePage.test.jsx` was updated.** The original TASK-016 test rendered `WorkspacePage` without a Router. Adding `useNavigate` to WorkspacePage caused those tests to throw. The fix — wrapping in `MemoryRouter` and mocking `useAuth` — does not weaken the original assertions. Both original tests still assert the same structure (CSS Grid, three panels, placeholder text).

6. **Logout is fail-safe.** If `authService.logout()` throws unexpectedly, the `handleLogout` function in WorkspacePage uses `finally` to navigate to `/login` regardless. This is an intentional defensive choice: a user who clicks "Log out" should always be returned to the login page, even if the session store operation fails.

7. **Cookie clearing on logout.** `res.clearCookie('connect.sid')` sends an expired cookie to the browser. The actual session row deletion is handled by `session.destroy()`. Both are needed: `session.destroy()` removes the server-side state; `clearCookie` removes the client-side cookie so the browser does not re-send it.
