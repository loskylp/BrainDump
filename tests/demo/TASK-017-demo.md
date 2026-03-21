# Demo Script — TASK-017: Folder Management

**Task:** TASK-017
**Requirement:** REQ-017 — Folder management (create, rename, delete; assign notes to folders)
**Environment:** Staging — https://braindump.staging.nxlabs.cc
**Date:** 2026-03-21
**Prerequisites:** An authenticated user account. Open the workspace at `/workspace` before starting each scenario.

---

## Scenario 1 — Create a new folder (AC-1)

Given   | A logged-in user is on the workspace at `/workspace`
When    | The user clicks the "New Folder" button (or "+" icon) in the sidebar
Then    | An inline folder creation form appears with a text input
When    | The user types "Research" and confirms (Enter or submit button)
Then    | A folder named "Research" appears in the sidebar folder tree
        | The folder creation form closes

Screenshot: `01-folder-created.png`

---

## Scenario 2 — Folder name is required (AC-1 validation)

Given   | The folder creation form is open
When    | The user submits the form with an empty or whitespace-only name
Then    | The API returns 400 and the UI shows an inline validation error
        | No folder is created

---

## Scenario 3 — Rename a folder (AC-2)

Given   | A folder named "Research" exists in the sidebar
When    | The user clicks the rename/edit control on the folder row
Then    | The folder name becomes an editable input pre-filled with "Research"
When    | The user clears it, types "Literature Review", and confirms
Then    | The folder row now shows "Literature Review"
        | The API has updated the folder name (PUT /api/folders/:id returns 200)

Screenshot: `02-folder-renamed.png`

---

## Scenario 4 — Assign an existing note to a folder (AC-4)

Given   | A folder exists and a note is open in the editor
When    | The user opens the folder assignment dropdown in the editor toolbar
        | The user selects "Research" from the dropdown
Then    | The note's folder assignment is saved (PUT /api/notes/:id with folderId)
        | The sidebar shows the note listed under the "Research" folder when that folder is selected

Screenshot: `03-note-assigned-to-folder.png`

---

## Scenario 5 — Filtering notes by folder (AC-5)

Given   | At least one note is assigned to the "Research" folder and at least one note is unassigned
When    | The user clicks the "Research" folder in the sidebar folder tree
Then    | The note catalog shows only notes assigned to "Research"
        | Notes not in "Research" are not shown

Screenshot: `04-folder-filter-active.png`

---

## Scenario 6 — Delete a folder (AC-3)

Given   | A folder named "Research" exists and contains at least one note
When    | The user clicks the delete control on the folder row
        | A confirmation is requested (if applicable) and confirmed
Then    | The folder is removed from the sidebar folder tree
        | The notes that were in the folder are not deleted — they appear in the "All Notes" view with no folder assignment (folder_id = NULL via ON DELETE SET NULL constraint)

Screenshot: `05-folder-deleted.png`

---

## Scenario 7 — Deleting a folder does not delete its notes (AC-3 edge case)

Given   | After Scenario 6: the folder "Research" has been deleted
When    | The user clicks "All Notes" in the sidebar (no folder filter)
Then    | Notes that were previously in "Research" are still present in the catalog
        | Those notes have no folder label / show as unassigned

---

## Scenario 8 — API shape verification

Given   | A terminal with curl and a valid session cookie
When    | The following API calls are made in sequence:
          1. `POST /api/folders` `{"name":"Research"}` → 201
          2. `GET /api/folders` → 200 `{"folders":[{"id":"...","name":"Research",...}]}`
          3. `PUT /api/folders/:id` `{"name":"Literature Review"}` → 200
          4. `DELETE /api/folders/:id` → 204

Then    | All responses match the documented shapes above
        | After DELETE, `GET /api/folders` no longer includes the deleted folder

---

## Notes for the Nexus

- Folders are single-level only — nesting is not supported (ADR-003).
- The folder tree in the sidebar is sorted alphabetically by name.
- The "All Notes" view shows every note regardless of folder assignment.
- Deleting a folder does not cascade-delete notes; the ON DELETE SET NULL database constraint ensures notes remain accessible.
