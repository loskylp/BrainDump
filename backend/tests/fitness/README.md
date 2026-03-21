# Fitness Function Tests

This directory contains the dedicated fitness function test suite for BrainDump.
Each fitness function (FF-D ID) is listed below with its coverage status, the file
that implements it, and any known issues.

These tests run in the `migration-test` CI job (Job 4 in `.github/workflows/ci.yml`),
which provisions a fresh PostgreSQL instance, applies all migrations, then runs
`npx jest --forceExit --runInBand` across all files under `backend/tests/`.

---

## Coverage Map: FF-D01 to FF-D43

| ID | Characteristic | Status | Test File(s) | Notes |
|---|---|---|---|---|
| FF-D01 | Build integrity: project builds and all tests pass | COVERED | CI (`migration-test` job) | CI itself is the check; no discrete test file needed |
| FF-D02 | Bundle size: LCP < 2.5s, bundle < 500KB gzipped | GAP | — | Lighthouse CI required; see below |
| FF-D03 | Protected routes return 401 without valid session | COVERED | `acceptance/TASK-004-login-logout.test.js`, `acceptance/TASK-005-ownership-guard.test.js`, `unit/authenticate.test.js`, `unit/ownershipGuard.test.js` | |
| FF-D04 | Login failure returns 401 (not 500) | COVERED | `fitness/fitness-coverage.test.js`, `acceptance/TASK-004-login-logout.test.js` | Dedicated fitness label added |
| FF-D05 | Password reset: no user enumeration | COVERED | `acceptance/TASK-015-password-reset.test.js` | AC-3 verifies identical response for registered/unregistered email |
| FF-D06 | Expired reset tokens rejected | COVERED | `acceptance/TASK-015-password-reset.test.js` | AC-7 |
| FF-D07 | Logout invalidates session; protected routes return 401 | COVERED | `acceptance/TASK-004-login-logout.test.js`, `acceptance/TASK-004-login-logout-verifier.test.js` | |
| FF-D08 | Durability: write note, restart app, read back | GAP | — | Requires a real service restart; outside unit/acceptance test scope. Manual or infra-level check. |
| FF-D09 | Cascade delete user removes all associated data | COVERED | `acceptance/TASK-019-account-deletion.test.js` | Explicitly labeled FF-D09 |
| FF-D10 | Folder delete sets note.folder_id = NULL | COVERED | `acceptance/TASK-002-schema-acceptance.test.js` (AC-3 SET NULL verification) | FK ON DELETE SET NULL is schema-enforced |
| FF-D11 | Migrations apply cleanly to fresh DB | COVERED | CI (`migration-test` job) | The CI job itself is the check |
| FF-D12 | All expected FK constraints present | COVERED | `fitness/fitness-coverage.test.js`, `acceptance/TASK-002-schema-acceptance.test.js` (AC-10) | Dedicated fitness label added |
| FF-D13 | Auto-save updates notes row, does NOT create version | COVERED | `unit/noteService.updateNote.test.js` | "no version creation" describe block |
| FF-D14 | 30s idle + changed content creates new version | PARTIALLY COVERED | `unit/versionService.test.js` | Mocked; timer behaviour not end-to-end tested |
| FF-D15 | 30s idle + unchanged content does NOT create version | COVERED | `unit/versionService.test.js` | `returns created=false when content is unchanged` |
| FF-D16 | New note has initial version (version_number = 1) | COVERED | `fitness/fitness-coverage.test.js`, `acceptance/TASK-006-create-note-verifier.test.js`, `unit/noteService.test.js` | Dedicated fitness label added |
| FF-D17 | Restore updates note and creates new version entry | COVERED | `unit/versionService.test.js` | `restoreVersion` describe block |
| FF-D18 | Rapid auto-save calls do not create versions | PARTIALLY COVERED | `unit/versionService.test.js` | Mocked; concurrent/rapid call pattern not end-to-end tested |
| FF-D19 | Note with term in title returned by search | COVERED | `acceptance/TASK-014-search.test.js` (AC-4) | |
| FF-D20 | Note with term only in body returned by search | COVERED | `acceptance/TASK-014-search.test.js` (AC-5) | |
| FF-D21 | Title match ranks higher than body-only match | COVERED | `acceptance/TASK-014-search.test.js` (AC-6) | |
| FF-D22 | Search scoped to authenticated user only | COVERED | `acceptance/TASK-014-search.test.js` (AC-8), `unit/searchService.test.js` | |
| FF-D23 | Non-existent term returns empty set | COVERED | `acceptance/TASK-014-search.test.js` (AC-9) | |
| FF-D24 | Search across 200 notes completes in < 200ms | COVERED | `fitness/search-performance.test.js`, `acceptance/TASK-014-search.test.js` (AC-10) | Dedicated fitness test with GIN index verification |
| FF-D25 | ts_headline returns highlighted matching terms | COVERED | `acceptance/TASK-014-search.test.js` (AC-7) | |
| FF-D26 | User A cannot access User B's note (returns 404) | COVERED | `acceptance/TASK-005-ownership-guard.test.js`, `acceptance/TASK-005-ownership-guard-verifier.test.js` | |
| FF-D27 | User A cannot access User B's folder (returns 404) | COVERED | `acceptance/TASK-005-ownership-guard.test.js`, `acceptance/TASK-005-ownership-guard-verifier.test.js` | |
| FF-D28 | User A cannot access User B's note version (returns 404) | COVERED | `acceptance/TASK-005-ownership-guard.test.js`, `acceptance/TASK-005-ownership-guard-verifier.test.js` | |
| FF-D29 | User A's search never includes User B's notes | COVERED | `acceptance/TASK-014-search.test.js` (AC-8) | |
| FF-D30 | List endpoints return only authenticated user's resources | COVERED | `acceptance/TASK-005-ownership-guard.test.js` (AC-6) | |
| FF-D31 | RLS policy blocks access when app-level filter bypassed | COVERED | `acceptance/TASK-005-ownership-guard.test.js` (AC-7), `acceptance/TASK-002-schema-acceptance.test.js` (AC-5/AC-6/AC-7) | |
| FF-D32 | CI pipeline completes in < 10 minutes | GAP | — | CI self-measurement; cannot be asserted from within a test |
| FF-D33 | Docker image builds and starts within 5 seconds | GAP | — | Docker build timing; DevOps/infra scope |
| FF-D34 | Health check returns 200 after container start | GAP | — | Container lifecycle; DevOps scope |
| FF-D35 | CI flags changes to tailwind.config.js for review | GAP | — | CI workflow diff step; not implemented. DevOps scope. |
| FF-D36 | Lighthouse CI accessibility audit passes | GAP | — | Lighthouse CI required; see below |
| FF-D37 | No inline styles overriding Tailwind tokens | GAP | — | ESLint rule not configured; see below |
| FF-D38 | At 1920px, all three panels visible | GAP | — | Frontend responsive tests; not yet implemented |
| FF-D39 | At 800px, editor+preview visible, sidebar toggled | GAP | — | Frontend responsive tests; not yet implemented |
| FF-D40 | At 375px, single panel with tab bar | GAP | — | Frontend responsive tests; not yet implemented |
| FF-D41 | No horizontal scrollbar at 375/768/1024/1920px | GAP | — | Frontend responsive tests; not yet implemented |
| FF-D42 | Interactive elements >= 44px on viewports < 768px | GAP | — | Frontend responsive tests; not yet implemented |
| FF-D43 | Entrypoint runs migrations before starting app server | GAP | — | Docker entrypoint behaviour; DevOps/integration scope |

---

## Known Failing Tests

### FF-D02 — Bundle size / LCP (pre-existing gap)

Lighthouse CI is not configured. FF-D02 (LCP < 2.5s, bundle < 500KB gzipped) and
FF-D36 (accessibility audit) require a Lighthouse CI step in the CI workflow. This
is a DevOps task and is out of scope for TASK-020.

---

## Gap Descriptions

### Lighthouse CI gaps (FF-D02, FF-D36)

Both require `lighthouse-ci` configured as a CI step that runs against a deployed
or locally served frontend build. These are DevOps tasks — the application code
and tests cannot assert Lighthouse scores from within Jest.

### ESLint gap (FF-D37)

No ESLint rule currently blocks inline `style=` attributes that override Tailwind
tokens. Adding this requires an ESLint plugin (e.g., `eslint-plugin-no-inline-styles`
or a custom rule) and an update to `.eslintrc`. Out of scope for TASK-020.

### CI pipeline timing gap (FF-D32)

The 10-minute CI pipeline constraint cannot be asserted from within a test. It is
measured by observing the CI run duration in GitHub Actions. The current pipeline
is expected to complete well within this threshold based on existing job structure.

### Docker / container gaps (FF-D33, FF-D34, FF-D43)

These require a running Docker environment with the built image. They are DevOps
integration concerns. FF-D43 (migrations run before server start) should be
verified by examining the entrypoint script and confirmed by the migration-test
CI job passing (which proves migrations ran before the test suite executed).

### Frontend responsive gaps (FF-D38 to FF-D42)

Viewport-based layout tests require a browser automation tool (e.g., Playwright
or Cypress) and the frontend built and served. These are not yet implemented.
They would live in `frontend/src/__tests__/` or a dedicated e2e directory.

---

## Test Execution

To run only the fitness function tests locally (requires a live PostgreSQL connection):

```bash
cd backend
POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
  npx jest --testPathPattern=tests/fitness --forceExit --runInBand
```

In CI the `migration-test` job runs all tests under `backend/tests/` including
these fitness tests. No additional configuration is required.
