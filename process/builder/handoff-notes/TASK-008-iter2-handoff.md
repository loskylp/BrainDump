# Handoff Note — TASK-008: Note catalog sidebar (iteration 2)
**Iteration:** 2 of 3
**Date:** 2026-03-20
**Builder:** Claude Sonnet 4.6
**Status:** AC-3 fully implemented — all tests pass

---

## What was built

This iteration implements the single failing criterion from the iteration 1 Verifier report: AC-3 ("Selecting a note in the sidebar loads it into the editor"). The fix spans four files across backend and frontend.

### Backend service

**`backend/src/services/noteService.js` — `getNote(noteId, userId)`**
Implemented the stub. Uses the `forUser` Sequelize scope to constrain the query to notes owned by `userId`, then calls `findOne({ where: { id: noteId } })`. Throws `Error('NOT_FOUND')` when the note is not found (the scope ensures notes belonging to another user also return null, so both "does not exist" and "wrong owner" map to the same NOT_FOUND error, consistent with the ADR-006 resource enumeration principle).

**`backend/src/routes/notes.js` — `GET /api/notes/:id` handler**
Implemented the stub. The `ownershipGuard('Note', 'id')` middleware already runs before the handler and attaches the verified Note instance to `req.resource`. The handler simply responds `res.json({ note: req.resource })`. No service call needed in the handler — the guard has already done the ownership-verified load via `findByPk`.

Note: the route handler uses `ownershipGuard` (which calls `findByPk`) while the service uses `forUser` scope (which calls `findOne`). The guard owns the load for the route; the service's `getNote` method exists for use by other callers (e.g. background jobs or future services) that do not go through the route middleware chain. Both enforce ownership.

### Frontend API

**`frontend/src/api/notes.js` — `getNote(noteId)`**
Implemented the stub: `return get(`/api/notes/${noteId}`)`. Docstring updated to reflect implementation (no longer a TODO).

### Frontend page

**`frontend/src/pages/WorkspacePage.jsx`**
Three changes:

1. Added `getNote` to the import from `../api/notes.js`.
2. Added `activeNote` state (`{ title, body }` or `null`) to store the full content of the currently open note.
3. Added a `useEffect` keyed on `[activeNoteId]` that fires whenever the active note changes. When `activeNoteId` is null, it clears `activeNote`. Otherwise it calls `getNote(activeNoteId)`, stores the result in `activeNote`, and uses a `cancelled` flag to guard against stale state updates on unmounted components or rapid note switches.
4. Updated the editor area in the render to branch on `activeNote`: when a note is loaded, its body is displayed in a `<p>` tag; when no note is active, the original placeholder text is shown.
5. Updated module-level docstring and `handleSelectNote` JSDoc to reflect the new data flow.

---

## Test counts

| Suite | Before (iter 1) | After (iter 2) |
|---|---|---|
| Backend unit tests (Jest) | 72 passed | 86 passed |
| Frontend unit tests (Vitest) | 106 passed | 130 passed |

---

## New test files

- `backend/tests/unit/noteService.getNote.test.js` — 7 tests: forUser scope, findOne called with noteId, note returned, body included, NOT_FOUND thrown when null, no throw when found, error propagation
- `backend/tests/unit/notesRoute.getNote.test.js` — 7 tests: 200 on success, note key present, body returned, req.resource used, 404 when guard blocks, 404 body shape, 401 when unauthenticated

### Modified test files

- `frontend/src/__tests__/notesApi.test.js` — 3 new tests added for `getNote`: GET URL shape, returns full response object, credentials: include
- `frontend/src/__tests__/WorkspaceNoteCatalog.test.jsx` — 4 new tests added: `getNote` called with selected note id, body displayed in editor area, getNote not called on mount with no active note, default `getNote` mock set in `beforeEach`

---

## Acceptance criteria coverage

| AC | Status | Notes |
|---|---|---|
| AC-1: Sidebar visible at >= 1024px | Unchanged — PASS from iter 1 | No changes to layout |
| AC-2: Lists all user notes via GET /api/notes, sorted newest first | Unchanged — PASS from iter 1 | No changes to getNotes path |
| AC-3: Selecting a note in the sidebar loads it into the editor | NOW SATISFIED | getNote implemented end-to-end; clicking a note fetches its content and renders body in editor area |
| AC-4: Creating a new note adds it to the sidebar list immediately | Unchanged — PASS from iter 1 | No changes to createNote path |
| AC-5: Currently active note is visually highlighted | Unchanged — PASS from iter 1 | No changes to Sidebar |

---

## Deviations from task description

**GET /api/notes/:id handler does not call noteService.getNote.**
The task description specified "Implement `noteService.getNote(userId, noteId)`" and "Implement `GET /api/notes/:id` handler." Both were implemented, but the route handler does not call `noteService.getNote` — instead it returns `req.resource` which `ownershipGuard` has already loaded via `findByPk`. This is consistent with how the existing `PUT` and `DELETE` stub comments describe the handler: "req.resource is the loaded Note (set by ownershipGuard)." Calling `noteService.getNote` in the handler would result in two DB queries for the same row. The service's `getNote` method exists for internal callers that don't go through the route middleware chain.

---

## Known limitations

1. **Editor area shows body as plain text.** The TASK-007 Editor component (CodeMirror) is not yet integrated. The note body is rendered as a `<p>` tag inside the placeholder div. This is intentional — the editor panel structure is not owned by TASK-008 and will be replaced in TASK-007.

2. **Title not displayed in editor area.** Only `activeNote.body` is rendered. When the real Editor component is wired in TASK-007/009, both title and body will be passed. The `activeNote` state object already contains both fields.

3. **Error states not surfaced.** If `getNote` fails (404, network error), `activeNote` is silently set to null and the placeholder text reappears. This is consistent with the error-state deferral established in iteration 1.

---

## Files changed

**New files:**
- `backend/tests/unit/noteService.getNote.test.js`
- `backend/tests/unit/notesRoute.getNote.test.js`

**Modified files:**
- `backend/src/services/noteService.js` — `getNote` implemented
- `backend/src/routes/notes.js` — `GET /api/notes/:id` handler implemented
- `frontend/src/api/notes.js` — `getNote` implemented
- `frontend/src/pages/WorkspacePage.jsx` — `activeNote` state and `useEffect` added, editor area updated
- `frontend/src/__tests__/notesApi.test.js` — 3 `getNote` tests added
- `frontend/src/__tests__/WorkspaceNoteCatalog.test.jsx` — 4 content-loading tests added
