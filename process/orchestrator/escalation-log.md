# Escalation Log

---

## ESC-001 -- 2026-03-20
**From:** Verifier (TASK-008 iteration 2) | **Type:** Stale test assertion
**Description:** `backend/tests/acceptance/TASK-005-ownership-guard-verifier.test.js` contains a `[VERIFIER-ADDED]` assertion: `expect(res.status).toBe(500)` for `GET /api/notes/:id`. This was correct when written -- the handler was a stub returning 500. TASK-008 iteration 2 implemented the handler; it now returns 200. The underlying ownership-guard criterion is satisfied more strongly now (200 for owner, not 404 or 401). The other assertions in the same test (`not.toBe(404)`, `not.toBe(401)`) still pass.
**Decision:** Deferred to next Verifier invocation (TASK-011 verification). The Verifier will update the assertion to `toBe(200)` as a regression fix instruction. This is not a TASK-008 regression -- it is a stale stub-era assertion. Does not require Nexus attention.
**Outcome:** Logged in Standing Routing Rules. Verifier will receive explicit instruction to fix `toBe(500)` to `toBe(200)` when dispatched for TASK-011.

---

## ESC-002 -- 2026-03-21
**From:** Nexus (production incident) | **Type:** CI pipeline failure / staging down
**Description:** All CI jobs failing on main branch. Staging environment unreachable at https://braindump.staging.nxlabs.cc because `build-and-push` job gates on all test jobs. Failed run: https://github.com/loskylp/BrainDump/actions/runs/23371723566. Four root causes identified:
1. `npm run test:unit` script missing from `backend/package.json` (unit-tests job fails)
2. No ESLint config file in `backend/` (lint job fails)
3. Integration-tests job does not run migrations before tests -- all 37 schema tests fail on empty DB
4. AC-8/AC-9/AC-10 tests in `schema.test.js` validate TASK-014 (Cycle 2) features not yet implemented
**Decision:** Hotfix applied directly. Builder fixes (1, 2, 4) and DevOps fix (3) committed together. No plan gate required per hotfix protocol.
**Outcome:** All four fixes committed. CI pipeline expected to pass on next push to main.
