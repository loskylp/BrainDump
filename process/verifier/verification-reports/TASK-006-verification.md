# Verification Report — TASK-006
**Task:** TASK-006 — Create a note with persistence
**Requirement(s):** REQ-004 — User can create a note; REQ-012 — Data durability
**ADR(s):** ADR-003 — Data persistence and schema design; ADR-004 — Auto-save and versioning architecture
**Date:** 2026-03-20
**Iteration:** 1
**Verdict:** PASS

---

## Summary

All 6 acceptance criteria pass. 83 tests pass across the TASK-006 suites (34 Builder unit + 27 Verifier acceptance + 22 pre-existing unit). Fitness function FF-D16 verified against the live database. Full regression clean: TASK-005, TASK-004, TASK-003, TASK-002, integration, and frontend all pass.

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Authenticated user can create a note via `POST /api/notes` with a title | PASS | 3 acceptance tests: returns 201 with session; 401 without session; 201 with no title (default empty string). Route wired to `noteService.createNote` via `router.use(authenticate)`. |
| 2 | Note persisted in PostgreSQL with auto-generated UUID, empty body, and timestamps | PASS | 5 acceptance tests: DB row exists after create; UUID format confirmed by regex; `body` is `''` in DB; `created_at`/`updated_at` are valid TIMESTAMPTZ; title stored correctly. |
| 3 | Initial version (version_number=1) created atomically in `note_versions` — same transaction as note creation | PASS | 5 acceptance tests: exactly one version row with `version_number=1`; version `body` is `''`; version `title` matches note title; atomicity confirmed (note exists IFF version count = 1); two separate notes each get an independent version_number=1 row. FF-D16 satisfied. |
| 4 | Duplicate titles are allowed | PASS | 3 acceptance tests: two identical-title notes both return 201 with distinct IDs; both rows exist in DB; different users can share title without conflict. |
| 5 | API returns created note: id, title, body, created_at, updated_at | PASS | 6 acceptance tests: response has `note` key; all required fields present; title matches submission; `body` is `""`; `id` is UUID; timestamps are ISO 8601 strings. |
| 6 | Note accessible only to its owner (ownership guard enforced) | PASS | 5 acceptance tests: User B → GET User A's note = 404; User B → PUT User A's note = 404; User B → DELETE User A's note = 404; DELETE has no effect on DB row; unauthenticated POST creates neither note nor version. |

---

## Test Suite Summary

### TASK-006 — Builder unit tests

| File | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| `backend/tests/unit/noteService.test.js` | 22 | 22 | 0 | All mocked-DB scenarios pass |
| `backend/tests/unit/notesRoute.test.js` | 12 | 12 | 0 | All route-level scenarios pass |
| **TASK-006 unit total** | **34** | **34** | **0** | |

### TASK-006 — Verifier acceptance tests (live database)

| File | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| `backend/tests/acceptance/TASK-006-create-note-verifier.test.js` | 27 | 27 | 0 | AC-1 through AC-6 fully covered |

### Verifier acceptance test breakdown

| Test group | Tests | Positive | Negative/Boundary | Verdict |
|---|---|---|---|---|
| AC-1: create via POST /api/notes | 3 | 1 | 2 [VERIFIER-ADDED] | PASS |
| AC-2: persistence in PostgreSQL | 5 | 4 | 1 [VERIFIER-ADDED] | PASS |
| AC-3: initial version atomicity (FF-D16) | 5 | 4 | 1 [VERIFIER-ADDED] | PASS |
| AC-4: duplicate titles allowed | 3 | 1 | 2 [VERIFIER-ADDED] | PASS |
| AC-5: response shape | 6 | 4 | 2 [VERIFIER-ADDED] | PASS |
| AC-6: ownership isolation | 5 | 0 | 5 [2 VERIFIER-ADDED] | PASS |
| **Total** | **27** | **14** | **13** | |

### Pre-existing unit tests (regression)

| File | Tests | Passed | Failed |
|---|---|---|---|
| `backend/tests/unit/authenticate.test.js` | 10 | 10 | 0 |
| `backend/tests/unit/ownershipGuard.test.js` | 13 | 13 | 0 |
| **Pre-existing unit total** | **23** | **23** | **0** |

### Full regression

| Task | Tests | Passed | Failed | Prior State |
|---|---|---|---|---|
| TASK-005 (Ownership guard — Verifier) | 34 | 34 | 0 | 34/34 — no regression |
| TASK-005 (Ownership guard — Builder) | 33 | 33 | 0 | 33/33 — no regression |
| TASK-004 (Login/Logout — Verifier) | 31 | 31 | 0 | 31/31 — no regression |
| TASK-004 (Login/Logout — Builder) | 21 | 21 | 0 | 21/21 — no regression |
| TASK-003 (Registration — Verifier) | 26 | 26 | 0 | 26/26 — no regression |
| TASK-003 (Registration — Builder) | 21 | 21 | 0 | 21/21 — no regression |
| TASK-002 (Schema — acceptance) | 47 | 47 | 0 | 47/47 — no regression |
| Integration (schema + rlsContext) | 45 | 45 | 0 | 45/45 — no regression |
| **Backend regression total** | **258** | **258** | **0** | |

### Frontend (Vitest)

- 13 test files, 77 tests, 77 passed, 0 failed — no regression.

---

## Fitness Function: FF-D16

**FF-D16 definition:** "Test: new note has initial version (version_number = 1)"

**Result:** PASS

Verified by AC-3 acceptance tests against the live database:
- `note_versions` contains exactly one row for the created note
- That row has `version_number = 1`
- The version captures the note's initial title and body snapshots
- Creating two independent notes each produces their own `version_number = 1` row

---

## Observations

**OBS-V006-01 (Not a blocker — consistent with prior tasks):** The `console.error` output during TASK-005 regression tests (lines like `Unhandled error: Error: Not implemented`) is produced by the TASK-005 ownership guard verifier when it calls the owner's own resource routes (GET/PUT/DELETE), which are expected to reach the still-unimplemented handlers and return 500. This is the documented test behaviour for owner-access positive path tests at TASK-005 scope. No new error output was introduced by TASK-006.

**OBS-V006-02 (Informational — correct per ADR-004):** The `noteService.js` module retains `TODO: TASK-009` and `TODO: TASK-010` comments on the stub methods (`getNotes`, `getNote`, `updateNote`, `deleteNote`). This is correct scaffolding: those methods are intentionally unimplemented, their route handlers call `next(new Error('Not implemented'))`, and they will be completed in their respective tasks. The implemented `createNote` function is clean with no stale TODOs.

---

## Iteration History

| Iteration | Date | Verdict | Notes |
|---|---|---|---|
| 1 | 2026-03-20 | PASS | All 6 AC pass on first verification. Full regression clean. |
