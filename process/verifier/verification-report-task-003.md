# Verification Report -- TASK-003
**Task:** TASK-003 -- User registration
**Requirement:** REQ-001 -- User registration
**Date:** 2026-03-20
**Iteration:** 2
**Verdict:** PASS

---

## Summary

All six acceptance criteria are satisfied. Both failures from iteration 1 have been resolved:

1. **AC-6 fix confirmed:** `@testing-library/jest-dom` is installed, `frontend/src/setupTests.js` exists and imports the matchers, and `vitest.config.js` has `setupFiles: ['./src/setupTests.js']`. All 13 frontend TASK-003 tests now pass (58 total frontend tests pass).

2. **TASK-002 regression fix confirmed:** `createTableIfMissing` is absent from `backend/src/config/session.js`. Migration `20260319000007-create-sessions.js` creates the `session` table through the standard Sequelize migration lifecycle. The `[VERIFIER-ADDED]` table-count and SequelizeMeta-count assertions in `backend/tests/acceptance/TASK-002-schema-acceptance.test.js` were updated from 6 to 7 (Verifier action, within scope of the explicit requirement change signal for the session migration addition). All TASK-002 tests pass.

Full regression suite: 142 backend tests pass, 58 frontend tests pass. Zero failures across all suites.

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | A visitor can submit a valid username, email, and password to create an account | PASS | `POST /api/auth/register` returns 201 with `{ user: { id, username, email } }`. User row persisted in `users` table. UUID v4 primary key confirmed. 3 positive + 3 negative/verifier-added tests pass. |
| 2 | Password is hashed with bcryptjs (cost factor 12) before storage | PASS | `bcrypt.getRounds(user.password_hash)` returns 12. `bcrypt.compare(plaintext, hash)` validates correctly. Wrong password returns false. 2 positive + 1 negative verifier-added test pass. |
| 3 | Email uniqueness enforced; duplicate email returns a clear error message | PASS | Duplicate email returns 409 with `{ error: "EMAIL_TAKEN" }`. No second user row created. Case-insensitive deduplication confirmed. Distinct email accepted. 2 positive + 2 verifier-added tests pass. |
| 4 | Password minimum length: 8 characters (server-side validation) | PASS | 7-char password returns 400 `VALIDATION_ERROR`. 1-char and absent password also return 400. Exactly 8 chars returns 201 (boundary). 3 positive + 2 verifier-added tests pass. |
| 5 | On successful registration, a session is created and the user is redirected to the workspace | PASS | `Set-Cookie: connect.sid=...` present in 201 response. Cookie contains `HttpOnly` and `SameSite=Strict`. Failed registrations (409, 400) do NOT set a session cookie. `RegisterPage.jsx` navigates to `/workspace` on `onSuccess`. 3 positive + 2 negative verifier-added tests pass. |
| 6 | Registration form validates inputs client-side before submission | PASS | `RegisterForm.jsx` `validate()` enforces username non-empty, email format regex, and password >= 8 chars before calling the API. All 12 `RegisterForm.test.jsx` tests pass and all 3 `RegisterPage.test.jsx` tests pass under Vitest with jsdom + `@testing-library/jest-dom`. Total: 15 frontend TASK-003 tests pass. |

---

## Test Suite Summary

### Backend test suite (Jest)

- **Test runner:** Jest 29.7.0
- **Test files run:** 5
  - `backend/tests/acceptance/TASK-003-registration-verifier.test.js` (Verifier -- 24 tests, 24 pass)
  - `backend/tests/acceptance/TASK-003-registration.test.js` (Builder -- 21 tests, 21 pass)
  - `backend/tests/acceptance/TASK-002-schema-acceptance.test.js` (Verifier -- TASK-002 regression, 52 tests, 52 pass)
  - `backend/tests/integration/schema.test.js` (Builder -- TASK-002, 36 tests, 36 pass)
  - `backend/tests/integration/rlsContext.test.js` (Builder -- TASK-002, 4 tests, 4 pass)
- **Total tests:** 142
- **Passed:** 142
- **Failed:** 0
- **Duration:** 15.4s

### Verifier acceptance tests breakdown (TASK-003-registration-verifier.test.js)

| Test group | Tests | Positive | Negative/Boundary | Verdict |
|---|---|---|---|---|
| AC-1: Valid registration | 6 | 3 | 3 (verifier-added) | PASS |
| AC-2: Password hashing (bcrypt/cost 12) | 3 | 2 | 1 (verifier-added) | PASS |
| AC-3: Email uniqueness (409 EMAIL_TAKEN) | 4 | 2 | 2 (verifier-added) | PASS |
| AC-4: Password min 8 chars (server-side) | 5 | 3 | 2 (verifier-added) | PASS |
| AC-5: Session creation (cookie attributes) | 5 | 3 | 2 (verifier-added) | PASS |
| FF-D03 (partial): Session userId integrity | 1 | 1 | 0 | PASS |
| **Total** | **24** | **16** | **8** | |

### Frontend test suite (Vitest)

- **Test runner:** Vitest 1.6.1
- **Test files:** 9 total, 9 pass
  - `src/__tests__/RegisterForm.test.jsx` (Builder TASK-003 -- 12 tests, 12 pass)
  - `src/__tests__/RegisterPage.test.jsx` (Builder TASK-003 -- 3 tests, 3 pass)
  - `src/__tests__/App.test.jsx` (TASK-016 -- 4 tests, 4 pass)
  - `src/__tests__/ProtectedRoute.test.jsx` (TASK-016 -- 3 tests, 3 pass)
  - `src/__tests__/WorkspaceLayout.test.jsx` (TASK-016 -- 3 tests, 3 pass)
  - `src/__tests__/WorkspacePage.test.jsx` (TASK-016 -- 2 tests, 2 pass)
  - `src/__tests__/client.test.js` (TASK-016 -- 7 tests, 7 pass)
  - `src/__tests__/tailwind-tokens.test.js` (TASK-016 -- 23 tests, 23 pass)
  - `src/__tests__/vite-config.test.js` (TASK-016 -- 1 test, 1 pass)
- **Total tests:** 58
- **Passed:** 58
- **Failed:** 0
- **Duration:** 4.4s

---

## Regression Check

| Task | Prior state (iteration 1) | Current state (iteration 2) |
|---|---|---|
| TASK-016 (Workspace layout) | 43/43 pass | 43/43 pass -- no regression |
| TASK-002 (Schema/migrations/RLS) | 51/52 -- 1 regression | 52/52 pass -- regression resolved |
| TASK-003 backend (Builder tests) | 21/21 pass | 21/21 pass |
| TASK-003 backend (Verifier tests) | 24/24 pass | 24/24 pass |
| TASK-003 frontend (Builder tests) | 2/13 pass (broken infra) | 15/15 pass |

---

## Verifier Actions Taken (Iteration 2)

The routing instruction for iteration 2 included an explicit requirement change signal: the session migration (20260319000007-create-sessions.js) was added, changing the expected table and SequelizeMeta counts from 6 to 7. Per the iterate-loop immutability exception for explicit requirement change signals, the following test updates were made:

- `backend/tests/acceptance/TASK-002-schema-acceptance.test.js`, test name `[VERIFIER-ADDED] exactly 6 tables exist in public schema (5 app + SequelizeMeta)` — updated assertion from `toBe(6)` to `toBe(7)`, test name updated to reflect the new count and reason.
- `backend/tests/acceptance/TASK-002-schema-acceptance.test.js`, test name `[VERIFIER-ADDED] SequelizeMeta records all 6 migration files as applied` — updated assertion from `toBe(6)` to `toBe(7)`, added `expect(names.some(n => n.includes('create-sessions'))).toBe(true)`, test name updated.

Note: the root-level file `tests/acceptance/TASK-002-schema-acceptance.test.js` had already been updated to 7 (by the Builder as part of the handoff). The `backend/` copy is the one actually executed by the Jest runner (per `jest.config.js` `testMatch: '<rootDir>/tests/**/*.test.js'` with rootDir = `backend/`).

---

## Observations

**OBS-V003-01 (Resolved -- informational):** The duplicate file situation (`tests/acceptance/TASK-002-schema-acceptance.test.js` at the project root vs. `backend/tests/acceptance/TASK-002-schema-acceptance.test.js`) is a structural artifact of the project layout. The root-level copy appears to be the Verifier's authored canonical source; the backend copy is the one the Jest runner executes. These two files were out of sync at the start of iteration 2. Going forward, the Verifier should treat `backend/tests/` as the authoritative location for all backend test files that Jest will execute.

**OBS-V003-02 (Resolved):** `connect-pg-simple`'s `createTableIfMissing: true` option has been removed from `backend/src/config/session.js`. The session table is now managed by migration `20260319000007-create-sessions.js`, consistent with the project's migration-managed schema approach.

**OBS-V003-03 (Stale comment -- informational):** `backend/src/app.js` line 4 in the middleware chain comment says `4. sessionMiddleware   -- express-session with PostgreSQL store (TASK-004)`. The session middleware is fully operational as of TASK-003. The `(TASK-004)` annotation is stale. Not a blocker.

**OBS-V003-04 (React Router -- informational):** Frontend test output includes React Router v6 future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`). These are deprecation notices, not failures. They do not affect test correctness and are not a blocker for this task.
