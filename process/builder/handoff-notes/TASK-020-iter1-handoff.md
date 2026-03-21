# Handoff Note — TASK-020 Iteration 1

**Task:** TASK-020 | **Date:** 2026-03-21 | **Builder:** Claude Sonnet 4.6
**Status:** Implementation complete — awaiting CI validation (local PostgreSQL unavailable)

---

## What Was Built

Three files created under `backend/tests/fitness/`:

### `backend/tests/fitness/search-performance.test.js`

Dedicated fitness function test for FF-D24 (search performance baseline) and its
GIN index verification support check.

- Seeds 200 notes for an isolated test user via `Note.bulkCreate()` — single INSERT for speed
- Each note has distinct title and body content with a shared searchable term so the tsvector/GIN index is actually exercised by the trigger
- Measures HTTP round-trip time via `Date.now()` and asserts response < 200ms
- Runs `EXPLAIN (ANALYZE, FORMAT JSON)` directly against the database and asserts:
  - The plan references `idx_notes_search`
  - The plan does NOT contain `Seq Scan on notes`
- Teardown: `DELETE FROM users WHERE id = :id` — CASCADE removes all 200 notes

### `backend/tests/fitness/fitness-coverage.test.js`

Fitness-labeled tests for three FF-D IDs that were either not covered by any test
or only covered implicitly without an FF-D label:

- **FF-D04**: `POST /api/auth/login` with wrong password returns 401 (not 500);
  unknown email also returns 401 (not 500). Tests against a live registered user.
- **FF-D12**: Schema introspection confirms all 5 expected FK constraints with correct
  ON DELETE rules. Runs against the live schema.
- **FF-D16**: `POST /api/notes` produces a `version_number=1` row in `note_versions`
  verified directly via `sequelize.query`. Atomicity negative test (failed creation
  leaves no orphan version).

### `backend/tests/fitness/README.md`

Complete coverage map for all 43 dev-side fitness functions (FF-D01 through FF-D43),
listing each as COVERED, PARTIALLY COVERED, or GAP with the specific test file(s)
and notes on why gaps cannot be closed within the test suite.

---

## Coverage Report

### Covered by fitness tests (this task)

| ID | File |
|---|---|
| FF-D24 | `fitness/search-performance.test.js` (new, dedicated) |
| FF-D04 | `fitness/fitness-coverage.test.js` (new label; behavior already in TASK-004) |
| FF-D12 | `fitness/fitness-coverage.test.js` (new label; behavior already in TASK-002) |
| FF-D16 | `fitness/fitness-coverage.test.js` (new label; behavior already in TASK-006) |

### Covered by existing tests (pre-TASK-020)

FF-D01 (CI), FF-D03, FF-D05, FF-D06, FF-D07, FF-D09, FF-D10, FF-D11, FF-D13,
FF-D14 (partial), FF-D15, FF-D17, FF-D18 (partial), FF-D19, FF-D20, FF-D21,
FF-D22, FF-D23, FF-D25, FF-D26, FF-D27, FF-D28, FF-D29, FF-D30, FF-D31

### Documented gaps (cannot be closed within test suite scope)

| ID | Gap reason |
|---|---|
| FF-D02 | Lighthouse CI — DevOps task |
| FF-D08 | Service restart required — infrastructure scope |
| FF-D32 | CI pipeline timing — self-measurement only |
| FF-D33 | Docker build timing — DevOps scope |
| FF-D34 | Docker health check — DevOps scope |
| FF-D35 | tailwind.config.js CI diff — DevOps scope |
| FF-D36 | Lighthouse CI accessibility — DevOps task |
| FF-D37 | ESLint rule not configured — DevOps/configuration task |
| FF-D38–42 | Frontend responsive tests — browser automation not yet set up |
| FF-D43 | Docker entrypoint migration — DevOps/integration scope |

---

## Deviations

1. **AC-5 (Lighthouse CI for FF-D02/FF-D36)**: Not implemented. The routing
   instruction guidance explicitly permits documenting these as gaps rather than
   adding Lighthouse CI infrastructure. Documented in README.

2. **AC-6 (ESLint rule for FF-D37)**: Not implemented. Documented as a gap.

3. **AC-7 (tailwind.config.js CI diff for FF-D35)**: Not implemented. Documented as a gap.

These three acceptance criteria were identified in the routing instruction as "DevOps
scope" with explicit guidance to document rather than implement.

---

## Test Results

Local PostgreSQL is unavailable (Docker volume corrupted — pg_filenode.map I/O error
from prior sessions). Both fitness test files pass `node --check` (syntax validation).
CI validation via the `migration-test` job (Job 4) will run the full suite against
a fresh PostgreSQL 16 container.

The existing test suite is unchanged — no existing tests were modified.

---

## Observations

- The `EXPLAIN (ANALYZE, FORMAT JSON)` approach in the GIN index test is more robust
  than the `EXPLAIN` text-scan approach used in TASK-014-search.test.js AC-3, because
  it gives a structured plan that is easier to assert against regardless of PostgreSQL
  version differences in plan text formatting.

- FF-D14 and FF-D18 (auto-save timer behavior) are mocked in unit tests only. The
  30-second idle timer is a frontend concern. True end-to-end coverage would require
  browser automation with timer control (e.g., Playwright with `page.clock.tick()`).
  These are noted as PARTIALLY COVERED in the README.
