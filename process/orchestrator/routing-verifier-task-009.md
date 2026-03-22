# Routing Instruction
**To:** Verifier
**Phase:** EXECUTION -- Cycle 1
**Task:** TASK-009 -- Edit a note (API and editor integration)
**Iteration:** 1 of 3
**Verifier mode:** Full (may write new tests and run existing ones)
**Load these artifacts:**
- `process/planner/task-plan-v1.md` (TASK-009 section -- acceptance criteria, dependencies, fitness functions)
- `process/analyst/requirements-v2.md` (REQ-005 -- Edit a note)
- `process/architect/adr/ADR-004-note-lifecycle.md` (note lifecycle, auto-save owns notes row only, no NoteVersion on plain edit)
- `process/architect/adr/ADR-006-data-isolation.md` (RLS, ownership guard, 404 not 403)
- `process/architect/fitness-functions.md` (fitness function index)
- `process/devops/environment-contract-v1.md` (environment variables, test execution contract)
- `process/verifier/verification-reports/TASK-007-verification.md` (predecessor -- editor context)
- `process/verifier/verification-reports/TASK-008-verification.md` (predecessor -- sidebar/catalog context)
**Produce:**
- Verification Report for TASK-009 at `process/verifier/verification-reports/TASK-009-verification.md`
- Demo Script for TASK-009 (included in the report)
**Return to:** Orchestrator when complete

---

## Requirement

**REQ-005: Edit a note**
An authenticated user can edit the title and body of any note they own using the split-pane editor.

## Acceptance Criteria (5 total)

1. An authenticated user can edit the title and body of a note they own via `PUT /api/notes/:id`
2. The note's `updated_at` timestamp is updated on each save
3. Changes in the CodeMirror editor are sent to the API (manual save path; auto-save wiring is TASK-012)
4. Attempting to edit a note owned by another user returns 404
5. The editor loads existing note content (title and body) when opening a note from the catalog

## What the Builder Implemented

The Builder completed TASK-009 with WIP changes (not yet committed). All implementation is in place:

### Backend
- **`backend/src/services/noteService.js`** -- `updateNote(noteId, userId, updates)` implemented: transaction-scoped with `SET LOCAL app.current_user_id` (RLS/ADR-006), finds note via `forUser` scope, updates title/body/folderId fields if provided, calls `note.save()` which auto-updates `updated_at`. Throws `NOT_FOUND` for missing/wrong-owner notes. Does NOT create NoteVersion (correct per ADR-004).
- **`backend/src/routes/notes.js`** -- `PUT /:id` route handler: extracts `{ title, body, folderId }` from req.body, delegates to `noteService.updateNote()`, returns `{ note }`. Protected by `ownershipGuard('Note', 'id')`.
- **`backend/tests/unit/noteService.updateNote.test.js`** -- New unit tests for the service function (mocked DB).
- **`backend/tests/unit/notesRoute.updateNote.test.js`** -- New unit tests for the route handler (mocked service).

### Frontend
- **`frontend/src/api/notes.js`** -- `updateNote(noteId, updates)` implemented: delegates to `put(/api/notes/${noteId}, updates)`.
- **`frontend/src/pages/WorkspacePage.jsx`** -- Added `editorTitle` state, title input field with `data-testid="note-title-input"`, Save button with `data-testid="save-button"`, `handleSave()` calling `updateNote()`, Cmd/Ctrl+S keyboard shortcut via global keydown listener. Note selection now populates both title and body.
- **`frontend/src/__tests__/notesApi.test.js`** -- Extended with 4 tests for `updateNote()`.
- **`frontend/src/__tests__/WorkspaceNoteEdit.test.jsx`** -- New test file covering Save button, Cmd+S shortcut, and title/body loading on note open.

### Test Results (Builder)
- Frontend (Vitest): 257/257 pass
- Backend unit (Jest): 117/117 pass
- No TODO markers for TASK-009 remain

## Verification Instructions

1. **Run all existing tests** to confirm no regressions (both `backend/tests/unit` and `frontend` suites)
2. **Write acceptance tests** for each of the 5 ACs -- focus on integration-level verification:
   - AC-1: PUT /api/notes/:id updates title and body (backend acceptance test against live DB)
   - AC-2: updated_at changes after PUT (compare before/after timestamps)
   - AC-3: Save button click and Cmd/Ctrl+S both trigger updateNote API call (frontend integration)
   - AC-4: PUT to another user's note returns 404 (backend acceptance test with two users)
   - AC-5: Selecting a note from catalog populates title input and editor body (frontend integration)
3. **Verify fitness functions:**
   - No specific fitness function is tagged on TASK-009, but check that the edit path does not violate FF-D02 (preview latency) or FF-D03 (auth guard)
4. **Regression check:** All prior task tests must still pass
5. **Record observations** for any non-blocking concerns

## Constraints

- Do NOT modify production code -- verification only
- Do NOT implement auto-save (TASK-012) or version creation (TASK-013)
- Backend acceptance tests require POSTGRES_URL -- follow the Environment Contract
- The `ownershipGuard` middleware is already tested; focus acceptance tests on the full request/response cycle
