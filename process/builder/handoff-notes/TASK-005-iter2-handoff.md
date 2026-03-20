# Handoff Note — TASK-005 Iteration 2

**Task:** Targeted routing bug fix — versions list route unreachable
**Builder:** Claude Sonnet 4.6
**Date:** 2026-03-20
**Status:** Fix applied, unit tests pass

---

## What Was Done

Single-line fix in `backend/src/routes/versions.js` line 66.

**Change:** `router.get('/', ...)` → `router.get('/versions', ...)`

The versions router is mounted by the parent router at `/api/notes/:id`. Express strips the mount prefix when matching against child router paths, so registering the list route as `'/'` made it unreachable at `GET /api/notes/:id/versions`. The `ownershipGuard` on that route was therefore never reached. Changing the path to `'/versions'` makes the full URL `/api/notes/:id/versions` resolve correctly.

---

## Test Results

- Unit tests: **22 passed, 0 failed** (`tests/unit/authenticate.test.js`, `tests/unit/ownershipGuard.test.js`)
- Acceptance/integration tests: all fail at environment setup (`POSTGRES_URL environment variable is required`) — this is a pre-existing environment constraint, not caused by this change
- No unit test exists for the versions route itself; correctness of the routing fix is verifiable only through the acceptance test suite against a live database

---

## Deviations

None. The fix is exactly as specified in the iteration 2 routing instruction.

---

## Notes for Verifier

- The only file changed is `backend/src/routes/versions.js`, line 66
- The fix is purely additive to the route path string; no logic was altered
- `GET /api/notes/:id/versions` will now reach `ownershipGuard('Note', 'id')` followed by the handler stub, which calls `next(new Error('Not implemented'))` — this is the expected behavior for TASK-005 scope (full implementation is TASK-013)
