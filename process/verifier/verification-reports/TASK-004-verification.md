# Verification Report -- TASK-004
**Task:** TASK-004 -- User login and logout
**Requirement:** REQ-002 -- User login and logout
**Date:** 2026-03-20
**Iteration:** 2
**Verdict:** PASS

---

## Summary

All six acceptance criteria are satisfied. The Builder's iteration 2 fix replaced the false-negative `Max-Age=` assertion with a form that accepts either `Expires=` or `Max-Age=`, matching the actual behaviour of `express-session`. All 21 Builder tests and all 28 Verifier acceptance tests pass. Full regression across TASK-002, TASK-003, and TASK-016 is clean. 268 tests pass in total (191 backend, 77 frontend); 0 failures.

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | A registered user can log in with email and password | PASS | `POST /api/auth/login` returns 200 with `{ user: { id, username, email } }`. Case-insensitive email lookup confirmed. 3 positive tests, 2 negative tests pass. |
| 2 | On valid credentials, session cookie is HttpOnly, SameSite=Strict; userId stored in session | PASS | `connect.sid` cookie contains `HttpOnly` and `SameSite=Strict`. `GET /api/auth/me` with session cookie returns 200 and correct user. userId in session resolves to the registered user record. 6 positive tests, 2 negative tests pass. |
| 3 | 401 on invalid credentials; no enumeration leakage | PASS | Wrong password and unknown email both return 401. `error` code and `message` strings are identical for both cases. Error text does not reveal which field was wrong. Missing credentials return 400 (validation, not auth failure). 5 positive tests, 1 negative test pass. |
| 4 | An authenticated user can log out; session is destroyed in the PostgreSQL store | PASS | `POST /api/auth/logout` returns 200. Session is deleted from the store: subsequent `GET /api/auth/me` with the old cookie returns 401. Logout with no active session returns 200 (idempotent). 3 tests pass. |
| 5 | After logout, accessing protected routes returns 401 | PASS (partial scope) | `GET /api/auth/me` with old session cookie returns 401 after logout. Re-login after logout creates a valid new session. Full coverage against notes/folders/versions routes deferred to TASK-005 (authenticate middleware is a stub; those routes are not yet mounted). 3 tests pass. |
| 6 | 7-day rolling session expiry | PASS | Session middleware has `maxAge: 604800000` and `rolling: true`. Cookie carries `Expires=` set to 7 days in the future. Builder test now accepts either `Expires=` or `Max-Age=`. Verifier tests confirm expiry > 6 days ahead. 2 Builder tests + 2 Verifier tests pass. |

---

## Test Suite Summary

### Backend (Jest)

- **Test runner:** Jest 29.7.0
- **Test files run:** 7
- **Run mode:** `--runInBand` (serial execution; parallel worker contention on session-store tests causes an intermittent timeout in the Builder suite when both TASK-004 files run in parallel -- both suites pass cleanly when run serially, which is the correct mode for acceptance tests sharing a live database)

| File | Tests | Passed | Failed |
|---|---|---|---|
| `tests/acceptance/TASK-004-login-logout-verifier.test.js` (Verifier) | 28 | 28 | 0 |
| `tests/acceptance/TASK-004-login-logout.test.js` (Builder) | 21 | 21 | 0 |
| `tests/acceptance/TASK-003-registration-verifier.test.js` (regression) | 24 | 24 | 0 |
| `tests/acceptance/TASK-003-registration.test.js` (regression) | 21 | 21 | 0 |
| `tests/acceptance/TASK-002-schema-acceptance.test.js` (regression) | 52 | 52 | 0 |
| `tests/integration/schema.test.js` (regression) | 36 | 36 | 0 |
| `tests/integration/rlsContext.test.js` (regression) | 4 | 4 | 0 |
| **Total** | **191** | **191** | **0** |

### Verifier acceptance test breakdown (TASK-004-login-logout-verifier.test.js)

| Test group | Tests | Positive | Negative/Boundary | Verdict |
|---|---|---|---|---|
| AC-1: Valid credentials return 200 | 5 | 3 | 2 (verifier-added) | PASS |
| AC-2: Session cookie attributes + persistence | 7 | 5 | 2 (verifier-added) | PASS |
| AC-3: 401 on invalid credentials, no enumeration | 6 | 3 | 3 (verifier-added) | PASS |
| AC-4: Logout destroys session | 3 | 1 | 2 (verifier-added) | PASS |
| AC-5: Post-logout returns 401 | 3 | 2 | 1 (verifier-added) | PASS |
| AC-6: 7-day rolling session expiry | 2 | 2 | 0 | PASS |
| FF-D03: Unauthenticated routes return 401 | 2 | 1 | 1 (verifier-added) | PASS |
| **Total** | **28** | **17** | **11** | |

### Frontend (Vitest)

- **Test runner:** Vitest 1.6.1
- **Test files:** 13 total, 13 pass
- **Total tests:** 77 passed, 0 failed
- **TASK-004 tests:** 19 (LoginForm: 9, LoginPage: 3, useAuth: 5, WorkspaceLogout: 2)
- **Duration:** 5.77s

---

## Regression Check

| Task | Prior state (TASK-003 verification) | Current state |
|---|---|---|
| TASK-016 (Workspace layout) | 43/43 pass | 43/43 pass -- no regression |
| TASK-002 (Schema/migrations/RLS) | 52/52 pass | 52/52 pass -- no regression |
| TASK-003 backend Verifier | 24/24 pass | 24/24 pass -- no regression |
| TASK-003 backend Builder | 21/21 pass | 21/21 pass -- no regression |
| TASK-003 frontend | 15/15 pass | 15/15 pass -- no regression |

---

## Iteration History

| Iteration | Date | Verdict | Failure |
|---|---|---|---|
| 1 | 2026-03-20 | FAIL | Builder test line 141: `expect(sessionCookie).toContain('Max-Age=')` -- `express-session` emits `Expires=` not `Max-Age=`; implementation correct, assertion wrong |
| 2 | 2026-03-20 | PASS | Fix applied: assertion now accepts `Expires=` OR `Max-Age=`; all 191 backend + 77 frontend tests pass |

---

## Observations

**OBS-V004-01 (AC-5 scope gap -- expected, deferred to TASK-005):** AC-5 states "after logout, accessing protected routes returns 401." The `authenticate` middleware in `backend/src/middleware/authenticate.js` is currently a stub that throws "Not implemented" (TASK-005). No notes, folders, or versions routes are mounted in `app.js`. The Verifier tests use `GET /api/auth/me` as the available session-gated endpoint to demonstrate session invalidation after logout. This is a legitimate proxy for the AC's intent at this stage. Full AC-5 coverage against the actual protected API routes (notes, folders, versions) must be verified in TASK-005. Not a blocker for TASK-004.

**OBS-V004-02 (Stale comment -- non-blocker):** `backend/src/app.js` line 12 in the middleware chain comment reads `4. sessionMiddleware -- express-session with PostgreSQL store (TASK-004)`. Session middleware has been operational since TASK-003. The `(TASK-004)` annotation is stale. Not a blocker.

**OBS-V004-03 (React Router future flag warnings -- pre-existing):** Frontend test output continues to show React Router v6 future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`) and `act(...)` warnings in `App.test.jsx`. Pre-existing from TASK-003; do not affect test correctness. Not a blocker.

**OBS-V004-04 (Logout fail-safe in WorkspacePage -- architectural note):** The Builder's `handleLogout` in `WorkspacePage.jsx` uses `finally` to navigate to `/login` regardless of whether `authService.logout()` succeeds. Deliberate defensive choice documented in the handoff. Architecturally sound. No action required.

**OBS-V004-05 (Parallel worker contention -- operational note):** When both TASK-004 test files are run by Jest in parallel (default mode), the Builder's `GET /api/auth/me returns the authenticated user after login` test intermittently times out due to session-store write pressure from concurrent workers. Both files pass cleanly under `--runInBand`. This is not a behavioral defect. The CI pipeline should run acceptance tests with `--runInBand` or with `--maxWorkers=1` when tests share a live PostgreSQL session store. Flagged for the DevOps agent's attention at TASK-020/TASK-021.
