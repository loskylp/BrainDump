# Routing Instruction -- Builder
**Task:** TASK-020 | **Iteration:** 1 of 3
**Date:** 2026-03-21 | **From:** Orchestrator | **To:** Builder

---

## Context

TASK-020 instruments the dev-side fitness functions defined in `process/architect/fitness-functions.md` (FF-D01 through FF-D43) as automated tests in the CI suite. Many of these fitness functions are already covered by existing acceptance tests written during Cycle 1 and Cycle 2 tasks. This task performs the comprehensive instrumentation pass to ensure full coverage, with particular focus on:

1. **Search performance fitness function (FF-D24)** -- the primary gap. AC-10 of TASK-014 requires search across 200 notes to complete in < 200ms. While the existing TASK-014 acceptance test includes a performance assertion, a dedicated fitness function test should verify this with proper seeding, timing instrumentation, and GIN index usage verification via EXPLAIN ANALYZE.

2. **Any other FF-D gaps** -- the Builder should audit the fitness functions index against existing tests and fill gaps.

The existing TASK-014 acceptance test at `backend/tests/acceptance/TASK-014-search.test.js` already covers AC-10 (200 notes < 200ms) and AC-3 (GIN index). The fitness function test should be a dedicated, clearly-labeled test that serves as a regression guard specifically for the performance characteristic.

**Important:** These fitness function tests require a live PostgreSQL connection. They run as part of the `migration-test` job in CI (see `.github/workflows/ci.yml` -- Job 4), which provisions a fresh PostgreSQL instance, runs all migrations, then runs `npx jest --forceExit --runInBand`. Any test placed under `backend/tests/` will be picked up by this job.

## What to Build

### Step 1: Audit existing fitness function coverage

Read `process/architect/fitness-functions.md` and cross-reference every FF-D ID (FF-D01 through FF-D43) against existing test files in `backend/tests/` and `frontend/src/__tests__/`. Many FF checks were written as acceptance criteria within task-level tests. For each FF-D, determine if it is:
- **Covered** -- an existing test explicitly verifies this characteristic
- **Partially covered** -- a test touches the area but does not assert the specific fitness function condition
- **Not covered** -- no test exists

### Step 2: Create fitness function test suite

Create `backend/tests/fitness/search-performance.test.js` with the following tests:

**FF-D24: Search performance baseline**
- Seed 200 notes for a single test user (use the registration helper pattern from `backend/tests/acceptance/TASK-014-search.test.js`)
- Each note should have distinct title and body content (use a loop with indexed content)
- Run a search query via `GET /api/notes/search?q=<term>` where `<term>` matches at least some notes
- Measure response time using `Date.now()` or `process.hrtime()`
- Assert response time < 200ms
- Include the FF-D24 ID in a comment for traceability

**GIN index verification (supporting FF-D24)**
- Execute `EXPLAIN ANALYZE` on the search query directly against the database
- Assert the output contains `Bitmap Index Scan` on the `idx_notes_search` index (or equivalent GIN scan indicator)
- Assert the output does NOT contain `Seq Scan on notes` (which would indicate the index is not being used)
- This confirms the architectural decision in ADR-005 is being enforced at the database level

### Step 3: Create additional fitness function tests for uncovered gaps

Based on the audit in Step 1, create additional test files under `backend/tests/fitness/` for any FF-D IDs that are NOT already covered by existing tests. Organize by concern area:

- `backend/tests/fitness/search-performance.test.js` -- FF-D24, GIN index verification
- Additional files as needed based on the gap analysis (e.g., `durability.test.js`, `deploy.test.js`)

Each test must include a comment referencing its FF-ID for traceability (AC-4). Example:
```javascript
// FF-D24: Search across 200 notes completes in < 200ms
test('search across 200 notes returns within 200ms', async () => { ... });
```

### Step 4: Handle FF-D items that are NOT automated tests

Some FF-D items are Lighthouse CI checks (FF-D02, FF-D36), ESLint rules (FF-D37), or CI pipeline behaviors (FF-D35). For these:

**FF-D02 (Bundle size / LCP):** If Lighthouse CI is not already configured, note it as a gap but do not add Lighthouse CI infrastructure in this task -- that is DevOps scope. Document the gap.

**FF-D35 (tailwind.config.js change detection):** If not already implemented in CI, note it as a gap. This could be a simple CI step that diffs `tailwind.config.js` against main and fails/warns if changed.

**FF-D36 (Accessibility audit):** Same as FF-D02 -- Lighthouse CI scope.

**FF-D37 (No inline style overrides):** If not already an ESLint rule, note it as a gap. Do not add the rule in this task unless it is trivial.

For any item that cannot be instrumented as an automated test within this task's scope, create a summary comment in the test file or a separate `backend/tests/fitness/README.md` documenting the coverage status and what remains.

### Step 5: Tests

The fitness function tests ARE the deliverable for this task. Ensure:
- All new tests pass locally against a live PostgreSQL database
- All existing tests continue to pass (no regressions)
- The `backend/tests/fitness/` directory is created and properly organized

## Acceptance Criteria (from Task Plan)

1. All FF-D01 through FF-D43 dev-side fitness functions are implemented as automated tests in the test suite
2. Tests are organized by ADR/concern area (auth, durability, auto-save, versioning, search, isolation, deploy, aesthetic, responsive)
3. CI pipeline runs all fitness function tests as part of the standard test suite
4. Each test references its FF-ID in a comment for traceability
5. Lighthouse CI audit integrated for FF-D02 (LCP, bundle size), FF-D36 (accessibility)
6. ESLint rule configured for FF-D37 (no inline styles overriding Tailwind)
7. CI flags changes to `tailwind.config.js` for review (FF-D35)

**Guidance on AC-5, AC-6, AC-7:** These involve tooling configuration (Lighthouse CI, ESLint rules, CI workflow changes). If these are already in place, verify them. If not, document them as gaps in a coverage report rather than attempting to add full Lighthouse CI infrastructure. The primary deliverable is the test-based fitness functions (AC-1 through AC-4). AC-5/6/7 gaps should be documented clearly so they can be addressed as DevOps or configuration tasks.

## Files to Touch

| File | Action |
|---|---|
| `backend/tests/fitness/search-performance.test.js` | Create -- FF-D24 search performance + GIN index verification |
| `backend/tests/fitness/*.test.js` | Create as needed for uncovered FF-D gaps |
| `backend/tests/fitness/README.md` | Create -- coverage summary mapping each FF-D to its test or documenting gaps |

## Constraints

- All fitness function tests must run against a live PostgreSQL database (not mocked)
- Tests must be deterministic -- seed data must be isolated per test run (use unique user per test)
- Performance assertions should use reasonable margins -- the 200ms threshold is for 200 notes, not for CI overhead; if CI is slower than local, account for this by measuring only the HTTP response time, not test setup
- Do not modify existing acceptance tests -- fitness function tests are additive
- Do not modify the CI workflow (`.github/workflows/ci.yml`) -- the migration-test job already picks up all tests under `backend/tests/`
- Do not install new npm dependencies unless strictly necessary

## Commit Convention

Commit message: `TASK-020: Fitness function instrumentation -- [summary of what was done]`

Push to `main` branch after committing.

## Handoff

After completing implementation and tests, provide:
1. What was built (files changed/created)
2. Coverage report: which FF-D IDs are now covered, which remain as documented gaps
3. Test results (all tests passing, count)
4. Any deviations from this routing instruction
5. Any observations or concerns
