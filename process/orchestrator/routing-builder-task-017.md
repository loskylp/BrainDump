# Routing Instruction -- Builder
**Task:** TASK-017 | **Iteration:** 1 of 3
**Date:** 2026-03-21 | **From:** Orchestrator | **To:** Builder

---

## Context

TASK-017 implements folder organization (REQ-009, ADR-003). This is the first P2 task in Cycle 2. Users can create, rename, and delete single-level folders, and move notes into or out of folders. No nesting.

The infrastructure is already in place from Cycle 1 and the Cycle 2 Scaffolder:
- The `folders` table exists (migration `20260319000003-create-folders.js`) with columns: `id` (UUID), `user_id` (UUID, FK to users, CASCADE on delete), `name` (VARCHAR(100)), `created_at`, `updated_at`
- The `notes.folder_id` column exists (FK to folders, ON DELETE SET NULL)
- The `Folder` model is fully defined at `backend/src/models/Folder.js` with `forUser(userId)` scope
- The folder routes file (`backend/src/routes/folders.js`) has fully stubbed CRUD endpoints with authentication, RLS context, and ownership guard middleware already wired
- Frontend API stubs exist at `frontend/src/api/folders.js` with `getFolders`, `createFolder`, `updateFolder`, `deleteFolder`
- Frontend component stubs exist: `FolderTree.jsx`, `FolderCreateForm.jsx`
- The `noteService.updateNote` already supports `folderId` parameter for assigning a note to a folder (or `null` to remove)
- The `PUT /api/notes/:id` route already accepts `folderId` in the request body
- The frontend `updateNote(noteId, { folderId })` API function already exists

The `getNotes()` response already includes `folder_id` on each note -- the sidebar just does not use it yet.

**Standing observation:** OBS-V008-02 (getNotes error silently falls back to empty state) -- address if practical while integrating folders with the sidebar.

## What to Build

### Backend

#### Step 1: Implement folder CRUD in `backend/src/routes/folders.js`

Replace each stub handler. The `authenticate`, `rlsContext`, and `ownershipGuard` middleware are already wired in the stub file -- do not re-add them.

**GET /api/folders** (list all folders for authenticated user):
1. Use `Folder.scope({ method: ['forUser', req.session.userId] }).findAll({ order: [['name', 'ASC']] })`
2. Return `{ folders: [...] }` with 200

**POST /api/folders** (create a folder):
1. Read `req.body.name` -- if missing, empty, or blank after trim, return 400 with `{ error: 'VALIDATION_ERROR' }`
2. Create the folder: `Folder.create({ user_id: req.session.userId, name: name.trim() })`
3. Return `{ folder: {...} }` with 201

**GET /api/folders/:id** (get a single folder):
1. `ownershipGuard` has already loaded the folder into `req.resource`
2. Return `{ folder: req.resource }` with 200

**PUT /api/folders/:id** (rename a folder):
1. `ownershipGuard` has already loaded the folder into `req.resource`
2. Read `req.body.name` -- if missing, empty, or blank after trim, return 400 with `{ error: 'VALIDATION_ERROR' }`
3. Update `req.resource.name = name.trim()`, then `await req.resource.save()`
4. Return `{ folder: req.resource }` with 200

**DELETE /api/folders/:id** (delete a folder):
1. `ownershipGuard` has already loaded the folder into `req.resource`
2. `await req.resource.destroy()`
3. Return 204 with no body
4. Notes in this folder automatically get `folder_id = NULL` via the database ON DELETE SET NULL constraint -- no application code needed

#### Step 2: Verify folder routes are mounted in `backend/src/app.js`

Check that the folders router is mounted at `/api/folders`. If not already mounted, add:
```javascript
const foldersRouter = require('./routes/folders');
app.use('/api/folders', foldersRouter);
```

The Scaffolder may have already done this -- verify before adding.

#### Step 3: No new note route needed

Note-to-folder assignment is already handled by `PUT /api/notes/:id` with `{ folderId }` in the body. The `noteService.updateNote` already processes this. No additional route is needed.

However, the task plan scope mentions `PATCH /api/notes/:id/folder` as an alternative endpoint. Do NOT create this endpoint -- the existing `PUT /api/notes/:id` with `folderId` is sufficient and already tested.

### Frontend

#### Step 4: Implement `frontend/src/api/folders.js`

Replace each stub:
- `getFolders()`: `return get('/api/folders');`
- `createFolder(name)`: `return post('/api/folders', { name });`
- `updateFolder(folderId, name)`: `return put(\`/api/folders/${folderId}\`, { name });`
- `deleteFolder(folderId)`: `return del(\`/api/folders/${folderId}\`);`

#### Step 5: Implement `frontend/src/components/Sidebar/FolderCreateForm.jsx`

Replace the stub. This is a compact inline form for creating a new folder:
- Local state: `name` (string), `isLoading` (boolean), `errorMessage` (string|null)
- On submit: validate name is non-empty after trim, call `createFolder(name.trim())` from api/folders.js
- On success: call `onCreated(folder)`, reset name to ''
- On error: show inline error message
- Render: text input for name (placeholder "Folder name"), "Create" submit button, optional "Cancel" button (shown if `onCancel` prop provided)
- Escape key while input is focused: call `onCancel()` if provided
- Style consistently with sidebar design tokens (ADR-008): `text-sm`, `font-mono`, `bg-bg-secondary`, `border-border`

#### Step 6: Implement `frontend/src/components/Sidebar/FolderTree.jsx`

Replace the stub. This renders the folder navigation section in the sidebar:
- Render "All Notes" item at the top (onClick: `onFolderSelect(null)`)
- Render each folder as a clickable item (onClick: `onFolderSelect(folder.id)`)
- Highlight `activeFolderId` with active styles (same accent pattern as NoteItem in Sidebar.jsx: `bg-bg-tertiary border-l-2 border-accent` for active, `border-transparent` for inactive)
- Per-folder actions: rename button (opens inline rename input), delete button (with `window.confirm()` confirmation)
- On rename: call `updateFolder(folderId, newName)` from api/folders.js, then call `onFolderRenamed(folderId, newName)`
- On delete: call `deleteFolder(folderId)` from api/folders.js, then call `onFolderDeleted(folderId)`
- Keep it simple: no drag-and-drop, no context menu -- inline action buttons are sufficient for v1

#### Step 7: Integrate folders into `frontend/src/pages/WorkspacePage.jsx`

This is the main integration point. Add folder state and wiring:

1. **New state:**
   - `folders`: array of folder objects (fetched from `getFolders()`)
   - `activeFolderId`: string|null (null means "All Notes" -- show all notes)
   - `showFolderCreateForm`: boolean (toggles the inline create form)

2. **Load folders on mount:** Add a `useEffect` that calls `getFolders()` and sets the folders state. This can run in parallel with the existing `getNotes()` call.

3. **Filter notes by folder:** When `activeFolderId` is set, filter the `notes` array to show only notes with `folder_id === activeFolderId`. When null, show all notes. This is a client-side filter -- the full note list is already loaded.

4. **Update the sidebar rendering (`renderSidebar`):**
   - Above the note list (but below the search bar), render the FolderTree component with folders, activeFolderId, and handler callbacks
   - Below the FolderTree, render a "New folder" button that toggles `showFolderCreateForm`
   - When `showFolderCreateForm` is true, render `FolderCreateForm` inline
   - Pass the filtered notes (by activeFolderId) to the existing `Sidebar` component instead of all notes

5. **Folder handlers:**
   - `handleFolderSelect(folderId)`: set `activeFolderId` to folderId
   - `handleFolderCreated(folder)`: prepend to `folders` state, hide create form
   - `handleFolderRenamed(folderId, newName)`: update the folder in `folders` state
   - `handleFolderDeleted(folderId)`: remove from `folders` state, if `activeFolderId === folderId` then reset to null (All Notes)

6. **Move note to folder UI:** Add a folder assignment control to the editor toolbar (the bar with Save, History, Delete buttons). This can be a `<select>` dropdown listing all folders plus "No folder" option. On change, call `updateNote(activeNoteId, { folderId: selectedFolderId || null })` and update the note's `folder_id` in local state.

#### Step 8: Notes grouped under folders in sidebar

When no search is active, the sidebar should display notes organized by folder:
- If `activeFolderId` is null (All Notes view): show all notes in a flat list sorted by `updated_at DESC` (current behavior)
- If `activeFolderId` is set: show only notes in that folder, sorted by `updated_at DESC`

This is a straightforward filter on the existing `notes` array using `folder_id`.

### Tests

#### Step 9: Backend tests

**Acceptance tests** (`backend/tests/acceptance/TASK-017-folder-crud.test.js`):
- AC-1: POST `/api/folders` with valid name returns 201 and the folder appears in GET `/api/folders`
- AC-2: Created folder appears in sidebar (tested via GET `/api/folders` response structure)
- AC-3: PUT `/api/folders/:id` with new name returns 200 and the folder is renamed
- AC-4: PUT `/api/notes/:id` with `{ folderId }` moves the note into the folder; GET `/api/notes/:id` returns the updated `folder_id`
- AC-5: PUT `/api/notes/:id` with `{ folderId: null }` removes the note from the folder
- AC-6: GET `/api/notes` returns notes with correct `folder_id` values (notes without folder have `folder_id: null`)
- AC-7: DELETE `/api/folders/:id` returns 204; notes in deleted folder have `folder_id: null` (verified via GET `/api/notes`)
- AC-8: POST `/api/folders` rejects empty name (400)
- AC-9: GET/PUT/DELETE `/api/folders/:id` with another user's folder returns 404 (ownership guard)
- AC-10: GET `/api/folders` returns only the authenticated user's folders (not another user's)

**Unit tests** (`backend/tests/unit/folderRoutes.test.js`):
- GET `/api/folders` returns empty array for user with no folders
- POST `/api/folders` creates folder with trimmed name
- PUT `/api/folders/:id` updates folder name
- DELETE `/api/folders/:id` returns 204
- Validation: empty name rejected with 400

#### Step 10: Frontend tests

**Component tests** (`frontend/src/__tests__/FolderTree.test.jsx`):
- Renders "All Notes" item
- Renders each folder as a clickable item
- Highlights active folder
- Calls `onFolderSelect` when a folder is clicked
- Rename flow: shows inline input, submits, calls `onFolderRenamed`
- Delete flow: confirms, calls `onFolderDeleted`

**Component tests** (`frontend/src/__tests__/FolderCreateForm.test.jsx`):
- Renders input and submit button
- Validates non-empty name
- Calls `onCreated` with folder object on success
- Shows error on API failure
- Escape key calls `onCancel`

**Integration tests** (`frontend/src/__tests__/WorkspaceFolders.test.jsx`):
- Notes are filtered by selected folder
- "All Notes" shows all notes
- Folder select dropdown in editor toolbar changes note's folder
- New folder appears in FolderTree after creation

## Acceptance Criteria (from Task Plan)

1. An authenticated user can create a folder with a valid name via `POST /api/folders`
2. Folder appears in the sidebar catalog navigation
3. An authenticated user can rename a folder via `PUT /api/folders/:id`
4. An authenticated user can move a note into a folder via `PUT /api/notes/:id` (setting folder_id)
5. A note can be moved out of a folder (setting folder_id to null)
6. Notes without a folder appear at root level in the catalog
7. Deleting a folder moves its notes to root level (folder_id becomes NULL via ON DELETE SET NULL)
8. Nested folder creation is not available (single-level only)
9. Ownership guard enforced: user cannot access another user's folders (404)

## Files to Touch

| File | Action |
|---|---|
| `backend/src/routes/folders.js` | Implement (replace stubs) |
| `backend/src/app.js` | Verify folders router is mounted (may already be done) |
| `frontend/src/api/folders.js` | Implement (replace stubs) |
| `frontend/src/components/Sidebar/FolderTree.jsx` | Implement (replace stub) |
| `frontend/src/components/Sidebar/FolderCreateForm.jsx` | Implement (replace stub) |
| `frontend/src/pages/WorkspacePage.jsx` | Modify (add folder state, filtering, UI integration) |
| `frontend/src/components/common/Sidebar.jsx` | Possibly modify (accept filtered notes) |
| `backend/tests/acceptance/TASK-017-folder-crud.test.js` | Create |
| `backend/tests/unit/folderRoutes.test.js` | Create |
| `frontend/src/__tests__/FolderTree.test.jsx` | Create |
| `frontend/src/__tests__/FolderCreateForm.test.jsx` | Create |
| `frontend/src/__tests__/WorkspaceFolders.test.jsx` | Create |

## Constraints

- Do NOT create new database migrations -- the `folders` table and `notes.folder_id` column already exist
- Do NOT create a `PATCH /api/notes/:id/folder` endpoint -- use the existing `PUT /api/notes/:id` with `{ folderId }` body
- Folders are single-level only -- no `parent_folder_id`, no nesting UI
- Folder names must be non-empty after trim; max length enforced by the database (100 chars)
- All folder operations must enforce user ownership: `forUser` scope on list operations, `ownershipGuard` on single-resource operations
- Use bind parameters / Sequelize scopes -- never interpolate user input into queries
- Style frontend components consistently with existing sidebar using ADR-008 design tokens
- If addressing OBS-V008-02 (silent error fallback on getNotes), add a lightweight error indicator -- do not over-engineer

## Commit Convention

Commit message: `TASK-017: Folder organization -- [summary of what was done]`

Push to `main` branch after committing.

## Handoff

After completing implementation and tests, provide:
1. What was built (files changed/created)
2. Test results (all tests passing, count)
3. Any deviations from this routing instruction
4. Any observations or concerns
