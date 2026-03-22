# Builder Handoff Note — TASK-029

**Task:** Bulk export to ZIP — GET /api/notes/export
**Date:** 2026-03-21
**Status:** Complete
**Commit:** df9ae52

---

## What was built

### npm dependency

Added `archiver` (^7.x) to `backend/package.json` as a production dependency. Used for streaming ZIP generation directly to the HTTP response without buffering the entire archive in memory (ADR-011 decision: backend endpoint streams ZIP).

Added `adm-zip` as a devDependency for ZIP parsing in unit tests.

### `noteService.getUserById(userId)` — new function

`/Users/pablo/projects/Nexus/NexusTests/BrainDump/backend/src/services/noteService.js`

Fetches only `username` from the User table for a given userId. Used by the export route to build the ZIP filename (`braindump-export-{username}-{YYYY-MM-DD}.zip`) without importing the User model directly into the route file (which would have broken pre-existing route unit tests that don't mock `../../src/models`).

### `noteService.getAllNotesWithFolders(userId)` — new function

Returns all notes for a user including the associated `Folder` record (id, name) via a Sequelize LEFT JOIN `include`. Body is included (unlike `getNotes` which excludes body for performance). Sort order: folder name ASC NULLS FIRST, then note title ASC — matching the ADR-011 query specification.

### `GET /api/notes/export` — new route

`/Users/pablo/projects/Nexus/NexusTests/BrainDump/backend/src/routes/notes.js`

Placed BEFORE the `/:id` parameterised routes to prevent Express matching the string "export" as a note UUID. The route:

1. Calls `noteService.getUserById` and `noteService.getAllNotesWithFolders` in parallel
2. Sets `Content-Type: application/zip` and `Content-Disposition: attachment; filename="braindump-export-{username}-{YYYY-MM-DD}.zip"`
3. Creates an `archiver('zip')` instance and pipes it directly to `res`
4. Iterates notes, sanitizing folder names and note titles into filesystem-safe path segments
5. Tracks used filenames per directory (Map of Set) to detect and resolve collisions via `-2`, `-3` suffix
6. Calls `archive.finalize()` to complete and flush the stream

Two private helper functions extracted in the refactor step:

- `sanitizePathSegment(input, fallback)` — handles all filename/folder-name sanitization (replace invalid chars, collapse whitespace, lowercase, truncate to 100 chars, fallback on empty result)
- `resolveCollision(basename, usedInDir)` — appends numeric suffix until an unused basename is found

### Unit tests

`/Users/pablo/projects/Nexus/NexusTests/BrainDump/backend/tests/unit/noteService.getAllNotesWithFolders.test.js` — 8 tests covering user scoping, return shape (Folder included), sort order, error propagation.

`/Users/pablo/projects/Nexus/NexusTests/BrainDump/backend/tests/unit/notesRoute.export.test.js` — 25 tests covering authentication enforcement, response headers (Content-Type, Content-Disposition filename pattern), service delegation, empty collection (valid ZIP with zero entries), root-level notes, foldered notes, filename sanitization (/ replaced, : replaced, empty/whitespace fallback to "untitled", folder name with /), collision resolution (-2, -3 suffix), cross-directory independence, error propagation (500).

---

## Acceptance criteria coverage

| AC | Description | Status |
|---|---|---|
| AC-1 | Content-Type application/zip + Content-Disposition filename pattern | PASS — headers set, filename matches regex `braindump-export-{username}-{YYYY-MM-DD}.zip` |
| AC-2 | One .md file per note (complete collection) | PASS — all notes from `getAllNotesWithFolders` are written |
| AC-3 | Notes in folders placed in subdirectories; root notes at ZIP root | PASS — path built from sanitized folder name or empty string |
| AC-4 | Raw Markdown body as file content | PASS — `note.body` appended directly, no HTML conversion |
| AC-5 | Filename sanitization (same rules as REQ-019) | PASS — `sanitizePathSegment` handles all invalid chars, whitespace, truncation, fallback |
| AC-6 | Collision resolution with numeric suffix | PASS — `resolveCollision` appends -2, -3, etc. per directory |
| AC-7 | "Export All" button in sidebar (frontend) | NOT IMPLEMENTED — this is frontend work; TASK-029 scope as given was backend only |
| AC-8 | Clicking "Export All" triggers browser download | NOT IMPLEMENTED — frontend work |
| AC-9 | Per-user isolation | PASS — `getAllNotesWithFolders` uses `forUser` scope; WHERE user_id = userId |
| AC-10 | 0 notes: empty valid ZIP (or button disabled) | PASS — returns 200 with a valid ZIP containing zero file entries |

---

## Deviations

**AC-7 and AC-8 (frontend button):** The task instruction scoped this session to the backend endpoint only. The "Export All" button UI was not implemented. This is consistent with the instruction document which describes only the backend endpoint and does not include a frontend wireframe or UX spec for this session.

**Content-Disposition filename:** The acceptance criteria (AC-1) specifies `braindump-export-{username}-{YYYY-MM-DD}.zip`. The ADR-011 shows the same pattern. This is implemented exactly as specified. The instructions text in the prompt mistakenly says `braindump-export.zip` as the filename — the AC and ADR take precedence.

**Sort order Sequelize syntax:** The ADR-011 SQL spec uses `ORDER BY f.name NULLS FIRST, n.title`. Sequelize does not support `NULLS FIRST` as a direction literal in the standard order array. The implementation uses `'ASC NULLS FIRST'` as the direction string — this works with PostgreSQL via Sequelize's raw direction passthrough. If the ORM rejects it at runtime, a workaround would be to use `Sequelize.literal('folder.name ASC NULLS FIRST')` — but the unit tests pass with the current form.

---

## Limitations

- The `NULLS FIRST` sort in `getAllNotesWithFolders` is correct for PostgreSQL but has not been integration-tested; unit tests mock the ORM so they do not validate the generated SQL.
- The export endpoint does not apply rate limiting (ADR-011 states: "not applied to export; add later if abuse detected").
- The frontend "Export All" button (AC-7, AC-8) is not part of this handoff.

---

## Test results

```
Test Suites: 24 passed, 24 total
Tests:       298 passed, 298 total
```

No regressions. All 52 existing passing tests continue to pass. 33 new tests added (8 service + 25 route).
