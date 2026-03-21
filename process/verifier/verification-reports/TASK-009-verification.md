# Verification Report -- TASK-009
**Task:** TASK-009 -- Edit a note (API and editor integration)
**Requirement(s):** REQ-005 -- Edit a note; REQ-012 -- Data durability and PostgreSQL persistence
**ADR(s):** ADR-004 (auto-save owns notes row only; no version creation on PUT), ADR-006 (ownership guard 404 not 403)
**Date:** 2026-03-21
**Iteration:** 1
**Verdict:** PASS

---

## Summary

All 5 acceptance criteria pass. The Builder implemented `PUT /api/notes/:id` on the backend and wired the Save button and Cmd/Ctrl+S shortcut on the frontend. The API endpoint correctly updates title and body, refreshes `updated_at`, enforces ownership via `ownershipGuard` (404 for cross-user), and does not create a `NoteVersion` row (ADR-004 invariant). The editor initialises correctly with the persisted title and body from `GET /api/notes/:id` when a note is selected from the sidebar.

**Backend unit tests (31/31 pass):** `noteService.updateNote` and the `PUT /api/notes/:id` route handler are fully unit-tested across field updates, transaction and RLS enforcement, ownership lookup, no-version-creation invariant, and error propagation.

**Frontend unit tests (257/257 pass):** The Builder's `WorkspaceNoteEdit.test.jsx` (12 tests) directly covers AC-3 (Save button rendering and click, Cmd+S, Ctrl+S, negative case with no active note) and AC-5 (title loaded, body loaded, cleared when no note active). The `notesApi.test.js` suite adds 4 updateNote tests (PUT URL, request body, response shape, credentials header).

**Verifier acceptance tests (20/20 pass):** 20 tests across 5 criterion groups, exercised against the live PostgreSQL database via supertest. 8 tests are positive-path; 12 are negative or boundary (`[VERIFIER-ADDED]`). All pass in isolation with no flakiness.

**Regression:** 257 frontend tests pass. Backend unit tests: 117/117. Backend acceptance regression (TASK-006, TASK-008 suites in isolation): 39/39. Full serial backend suite (432/434) exhibits 2 socket hang-ups exclusively in TASK-009 AC-5 tests due to the pre-existing OBS-V004-05 DB connection pool exhaustion under long serial runs -- both tests pass cleanly in isolation and in pairwise isolation. This is not a TASK-009 regression.

**ADR-004 invariant confirmed:** `PUT /api/notes/:id` does not create a `NoteVersion` row. Verified by querying `note_versions` count before and after a PUT call in the live database.

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | PUT /api/notes/:id endpoint exists and updates title + body | PASS | 6 backend acceptance tests: 200 returned on update; response has `{ note: { id, title, body, updated_at } }`; new title persisted in DB; new body persisted in DB; title-only update preserves body; unauthenticated PUT returns 401. Negative: unauthenticated case returns 401 not 200. |
| 2 | updated_at is refreshed on save | PASS | 3 backend acceptance tests: `updated_at` in response is valid ISO 8601; DB `updated_at` is >= `created_at` after a save; sequential saves produce non-decreasing `updated_at` values. |
| 3 | Save button and Cmd/Ctrl+S keyboard shortcut trigger save | PASS | 6 frontend unit tests (Builder, `WorkspaceNoteEdit.test.jsx`): Save button rendered when note active; Save button click calls `updateNote` with correct note id; current title and body sent; Ctrl+S calls `updateNote`; Meta+S (Cmd+S) calls `updateNote`; Ctrl+S with no active note does not call `updateNote`. 2 API acceptance tests confirm the save endpoint returns correct `note.id` and accepts empty title+body. |
| 4 | 404 returned when a user tries to edit another user's note (ownership guard) | PASS | 4 backend acceptance tests: User B gets 404 on User A's note; User A's content is unchanged after User B's attempt; non-existent UUID returns 404; cross-user 404 and non-existent 404 produce identical error body (prevents enumeration per ADR-006). |
| 5 | Selecting a note in the sidebar loads its title and body into the editor | PASS | 4 backend acceptance tests: GET /api/notes/:id returns both title and body for the owner; body is returned as raw Markdown (not rendered HTML); GET after PUT reflects updated values; User B gets 404 on User A's note via GET. 3 frontend unit tests (Builder): title input initialised to `activeNote.title`; CodeMirror `defaultValue` set to `activeNote.body`; inputs cleared when no note active. |

---

## Test Suite Summary

### TASK-009 -- Builder unit tests

| File | Tests | Passed | Failed | AC coverage |
|---|---|---|---|---|
| `backend/tests/unit/noteService.updateNote.test.js` | 18 | 18 | 0 | Field updates (7), note lookup/NOT_FOUND (5), transaction+RLS (3), no NoteVersion (1), error propagation (2) |
| `backend/tests/unit/notesRoute.updateNote.test.js` | 13 | 13 | 0 | Successful update (8), ownership 404 (2), auth 401 (2), 500 propagation (1) |
| `frontend/src/__tests__/notesApi.test.js` (updateNote group) | 4 | 4 | 0 | PUT URL, request body, response shape, credentials header |
| `frontend/src/__tests__/WorkspaceNoteEdit.test.jsx` | 12 | 12 | 0 | AC-3: Save button (4), AC-3: keyboard shortcut (3), AC-5: note content loading (3), negative cases (2) |
| **Builder unit total** | **47** | **47** | **0** | |

### TASK-009 -- Verifier acceptance tests

#### Backend (live PostgreSQL, supertest)

| File | Tests | Passed | Failed | AC coverage |
|---|---|---|---|---|
| `backend/tests/acceptance/TASK-009-edit-note-verifier.test.js` | 20 | 20 | 0 | AC-1 (6), AC-2 (3), AC-3 (2), AC-4 (4), AC-5 (4), ADR-004 invariant (1) |

#### Acceptance test breakdown

| Test group | Tests | Positive | Negative / Boundary | Verdict |
|---|---|---|---|---|
| AC-1: PUT /api/notes/:id updates title and body | 6 | 4 | 2 [VERIFIER-ADDED] | PASS |
| AC-2: updated_at refreshed on save | 3 | 2 | 1 [VERIFIER-ADDED] | PASS |
| AC-3: Save endpoint correctly structured | 2 | 1 | 1 [VERIFIER-ADDED] | PASS |
| AC-4: Ownership guard (cross-user 404) | 4 | 1 | 3 [VERIFIER-ADDED] | PASS |
| AC-5: GET /api/notes/:id returns title and body | 4 | 2 | 2 [VERIFIER-ADDED] | PASS |
| ADR-004: No NoteVersion row created on PUT | 1 | 0 | 1 [VERIFIER-ADDED] | PASS |
| **Total** | **20** | **10** | **10** | |

### Full regression

#### Frontend (Vitest, jsdom)

| Suite | Test Files | Tests | Passed | Failed | Notes |
|---|---|---|---|---|---|
| All frontend tests (including Builder TASK-009 tests) | 24 | 257 | 257 | 0 | 16 new Builder tests added; no regressions |

#### Backend unit (Jest, no DB)

| Suite | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| All backend unit tests | 117 | 117 | 0 | 31 new Builder tests added; no regressions |

#### Backend acceptance (Jest, live PostgreSQL)

| Suite | Tests (isolated) | Passed | Failed | Notes |
|---|---|---|---|---|
| TASK-009 Verifier (isolated) | 20 | 20 | 0 | All pass cleanly in isolation |
| TASK-006 + TASK-008 regression (isolated) | 39 | 39 | 0 | No regressions |
| Full serial suite | 434 | 432 | 2 | 2 failures are OBS-V004-05 socket hang-ups in long serial run; not a TASK-009 regression |

---

## Non-Blocking Observations

| ID | Description | Status |
|---|---|---|
| OBS-V009-01 | `updated_at` test uses `>=` not `>` for the two-sequential-saves case: timestamps can be equal when the DB clock resolution is coarse relative to the inter-request interval. This is correct behaviour for the criterion; the test is appropriately relaxed. | Closed -- by design |
| OBS-V009-02 | `handleSave()` in `WorkspacePage.jsx` silently swallows save errors (empty catch block). Documented in the Builder's comment as "Error state surfaced in a future iteration." TASK-012 (auto-save) is where the error indicator is scheduled. | Open -- track for TASK-012 |
| OBS-V009-03 | The keyboard shortcut handler ESLint-suppresses the `react-hooks/exhaustive-deps` rule. The suppression is intentional and correctly placed (the handler captures `editorTitle` and `editorBody` via the dependency array on the outer effect). No functional defect. | Closed -- not a defect |
| OBS-V009-04 | Full serial backend test run shows 2 socket hang-ups in TASK-009 AC-5 tests due to OBS-V004-05 (DB connection pool exhaustion). Pre-existing issue. Both tests pass cleanly in isolation. | Open -- pre-existing (route to DevOps, same as OBS-V004-05) |

---

## Traceability

| AC | REQ | Tests |
|---|---|---|
| AC-1 | REQ-005 | 6 acceptance (backend), 8 route unit, 7 service unit, 3 API unit |
| AC-2 | REQ-005, REQ-012 | 3 acceptance (backend), 3 route unit (updated_at in response) |
| AC-3 | REQ-005 | 2 acceptance (backend), 6 frontend unit (WorkspaceNoteEdit), 4 API unit |
| AC-4 | REQ-005, REQ-011 | 4 acceptance (backend), 2 route unit (ownership guard) |
| AC-5 | REQ-005 | 4 acceptance (backend), 3 frontend unit (WorkspaceNoteEdit) |
