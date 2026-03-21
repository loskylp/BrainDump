# Verification Report — TASK-029: Bulk ZIP export backend

**Verdict:** PASS
**Task:** TASK-029 — Bulk export to ZIP
**Requirement:** REQ-020 — Full export to ZIP
**Date:** 2026-03-21
**Verifier invocation:** Initial

---

## CI Run Results — Run 23391441585

| Job | Status | Duration |
|---|---|---|
| Lint | PASS | 20s |
| Unit Tests | PASS | 47s |
| Integration Tests | PASS | 29s |
| Migration Test | PASS | 2m 48s |
| Build Docker Image | PASS | 23s |

All 5 jobs passed. The two lint warnings (`sequelize` assigned but unused in `tagService.js`; `isProduction` assigned but unused in `database.js`) are pre-existing and unrelated to TASK-029.

---

## Code Review Findings

### backend/package.json — archiver dependency

`archiver` version `^7.0.1` is present in `dependencies` (not `devDependencies`). Correct: it is a runtime dependency required to stream ZIP responses in production. `adm-zip` is in `devDependencies` (test-only use). Both are correctly placed.

### backend/src/routes/notes.js — route ordering (ADR-011 critical check)

`GET /api/notes/export` is declared at line 122. The first `/:id` route (`GET /:id`) is declared at line 224. The `/export` route is **before** all `/:id` routes. Express will match `/export` before it reaches the `/:id` pattern. This is correct and the ADR-011 implementation note is satisfied.

### backend/src/routes/notes.js — export route implementation

- `getUserById` and `getAllNotesWithFolders` are called in parallel via `Promise.all`, which is efficient.
- Response headers (`Content-Type: application/zip`, `Content-Disposition: attachment; filename="braindump-export-{username}-{YYYY-MM-DD}.zip"`) are set before streaming begins.
- `archiver` is piped directly to `res`; `archive.finalize()` is awaited before the handler resolves.
- The `usedNames` map is keyed by directory path (empty string for root), ensuring collision tracking is per-directory.
- `sanitizePathSegment` and `resolveCollision` are module-level helpers with clear single responsibilities.
- Error propagation via `next(err)` is present; the `try/catch` correctly routes unexpected errors to the Express error handler.

### backend/src/routes/notes.js — sanitizePathSegment helper

The sanitization pipeline exactly matches the documented rules:
1. Replace `/ \ : * ? " < > |` with hyphen
2. Replace runs of whitespace with hyphen
3. Collapse consecutive hyphens
4. Trim leading/trailing hyphens
5. Lowercase
6. Truncate to 100 characters
7. Fall back to the provided `fallback` string if result is empty

Folder fallback is `"unnamed-folder"`; note title fallback is `"untitled"`. Both match REQ-020 / the AC-5 specification.

### backend/src/routes/notes.js — resolveCollision helper

Starts at counter 2 (first collision → `-2`). Increments until an unused name is found. Correct implementation of the numeric suffix rule from REQ-020 GWT and AC-6.

### backend/src/services/noteService.js — getAllNotesWithFolders

Uses `Note.scope({ method: ['forUser', userId] })` for application-level user isolation (RLS provides DB-layer enforcement). Includes `Folder` with `required: false` (LEFT JOIN semantics — root notes have `folder: null`). Fetches all attributes (body is included, as required for ZIP content). Sort order: folder name `ASC NULLS FIRST`, then title `ASC` — matches ADR-011 query specification.

### backend/src/services/noteService.js — getUserById

Uses `User.findByPk(userId, { attributes: ['username'] })` — fetches only the username, avoids loading password hash or other sensitive fields. Returns `null` on miss; the route handler defensively falls back to `'user'` if null. Correct.

---

## Acceptance Criteria Results

AC-7 and AC-8 (frontend "Export All" button) are explicitly excluded from this backend-only verification, per the Orchestrator's instruction. The Builder's handoff note confirms these are deferred to a separate frontend task.

| Criterion | Description | Result |
|---|---|---|
| AC-1 | `GET /api/notes/export` returns `Content-Type: application/zip` and `Content-Disposition` header with filename `braindump-export-{username}-{YYYY-MM-DD}.zip` | PASS |
| AC-2 | ZIP contains one `.md` file per note owned by the authenticated user (complete collection) | PASS |
| AC-3 | Notes in folders placed in subdirectories matching the sanitized folder name; root-level notes at ZIP root | PASS |
| AC-4 | Each `.md` file contains the note's raw Markdown body (no HTML conversion, no version history) | PASS |
| AC-5 | Filenames derived from note titles, sanitized for filesystem safety (same rules as REQ-019) | PASS |
| AC-6 | Filename collisions within the same directory resolved with numeric suffix (`-2`, `-3`, ...) | PASS |
| AC-7 | "Export All" button visible in sidebar header; disabled with tooltip when note count is 0 | DEFERRED (frontend task) |
| AC-8 | Clicking "Export All" triggers browser download of the ZIP | DEFERRED (frontend task) |
| AC-9 | Per-user isolation: export endpoint returns only the authenticated user's notes | PASS |
| AC-10 | Exporting with 0 notes returns a valid empty ZIP (200, parseable, 0 file entries) | PASS |

---

## Test Evidence

### Builder unit tests (run locally — also run in CI Migration Test job)

File: `backend/tests/unit/notesRoute.export.test.js`
Result: 25 tests, 25 passed

File: `backend/tests/unit/noteService.getAllNotesWithFolders.test.js`
Result: 8 tests, 8 passed

### Verifier acceptance tests (new — run locally, will run in CI Migration Test)

File: `backend/tests/acceptance/TASK-029-bulk-export-verifier.test.js`
Result: 43 tests, 43 passed

Test breakdown by criterion:

AC-1 (6 tests): Content-Type, Content-Disposition, filename pattern, username isolation, unauthenticated rejection.
AC-2 (4 tests): One .md per note, 5-note GWT scenario, userId isolation positive and negative.
AC-3 (4 tests): Root note at root, folder note under subdirectory, mixing prevention, two-folder separation.
AC-4 (3 tests): Exact raw body, no HTML tags, empty body produces valid empty file.
AC-5 (13 tests): Each of 9 invalid characters tested individually, lowercase, space→hyphen, hyphen collapsing, empty title fallback, 100-char truncation, folder name sanitization.
AC-6 (3 tests): Two-way collision (-2 suffix), three-way collision (-2 and -3), cross-directory independence.
AC-9 (3 tests): getUserById called with correct userId, not called with other userId, getAllNotesWithFolders scoped correctly.
AC-10 (4 tests): HTTP 200, non-empty buffer, zero file entries, headers present for empty export.
Route ordering (1 test): /export resolves before /:id.

---

## Regression Check

The new acceptance test file `backend/tests/acceptance/TASK-029-bulk-export-verifier.test.js` will be included in the CI Migration Test job (`npx jest --forceExit --runInBand` from `backend/`). The CI run 23391441585 already passed the Migration Test (2m 48s), which ran the full `backend/tests/` suite including TASK-027 acceptance tests. This confirms no regressions were introduced by the TASK-029 implementation.

---

## Observations (non-blocking)

**OBS-029-01: Route ordering relies on convention, not a guard.**
The `GET /api/notes/export` route is correctly placed before `GET /:id`. This is documented in the route file's header comment. If a future developer adds a new static route (e.g., `GET /bulk`) and places it after the `/:id` route, it will silently fail. A lint rule or integration test asserting route declaration order would make this invariant explicit. This is a low-urgency observation; the current placement is correct.

**OBS-029-02: `archiver` error events are not explicitly handled.**
The `archive.pipe(res)` call will propagate errors from the archiver stream to the response. However, `archiver` can also emit `error` events on the stream itself. The current implementation wraps `archive.finalize()` in a `try/catch`, which catches errors from the `finalize()` Promise. Stream errors emitted asynchronously before `finalize()` resolves may not be caught. This is unlikely in practice (the archive is built from in-memory strings, not file reads), but worth noting. This does not affect the current test suite.

**OBS-029-03: Lint warnings in unrelated files.**
Two ESLint warnings are present in CI for TASK-027 code (`sequelize` unused in `tagService.js`) and infrastructure code (`isProduction` unused in `database.js`). These are pre-existing and unrelated to TASK-029. They should be cleaned up in a future pass or the Sentinel review.

---

## Demo Script

Stored at: `tests/demo/TASK-029-demo.md`
Scenarios: 7 (one per backend acceptance criterion, plus per-user isolation and empty collection)
