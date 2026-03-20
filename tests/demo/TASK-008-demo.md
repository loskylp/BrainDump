# Demo Script — TASK-008
**Task:** Note catalog sidebar
**Requirement:** REQ-008 — Note catalog (sidebar)
**Date:** 2026-03-20
**Environment:** Local development — backend at http://localhost:3000, frontend at http://localhost:5173

Prerequisites: PostgreSQL running, backend and frontend started (`docker-compose -f docker-compose.dev.yml up`). A registered and logged-in user session is available — referred to as USER_A throughout. A second registered user session (USER_B) is available for isolation scenarios. All curl commands use the session cookie from the most recent login response.

---

## Scenario 1 — Sidebar lists all user notes sorted newest first

AC-2 [REQ-008]

Given   USER_A has created three notes (oldest first, with a brief pause between each):
        - Note A: `{ "title": "Oldest Note" }`
        - Note B: `{ "title": "Middle Note" }`
        - Note C: `{ "title": "Newest Note" }`

When    GET http://localhost:3000/api/notes is requested with USER_A's session cookie

Then    the response status is 200
        and the response body has the shape `{ "notes": [ ... ] }`
        and `notes[0].title` is "Newest Note"
        and `notes[1].title` is "Middle Note"
        and `notes[2].title` is "Oldest Note"
        and each note entry contains `id`, `title`, and `updated_at`
        and no note entry contains a `body` field (excluded from list for performance)

---

## Scenario 2 — Notes list contains only the requesting user's notes

AC-2 [REQ-008] — isolation negative case

Given   USER_A and USER_B are both registered and logged in
        and USER_A has created "User A Private Note"
        and USER_B has created "User B Private Note"

When    GET http://localhost:3000/api/notes is requested with USER_A's session cookie

Then    the response contains "User A Private Note"
        and does NOT contain "User B Private Note"

When    GET http://localhost:3000/api/notes is requested without any session cookie

Then    the response status is 401

---

## Scenario 3 — Selecting a note fetches and displays its content

AC-3 [REQ-008]

Given   USER_A has at least one note in the catalog (from Scenario 1)
        and the note was created as: `{ "title": "Select Me", "body": "" }` with `id` NOTE_ID

Step 1 — Verify the note appears in the catalog list:

When    GET http://localhost:3000/api/notes is requested with USER_A's session cookie

Then    the response contains an entry with `id = NOTE_ID` and `title = "Select Me"`

Step 2 — Verify the note's full content is loadable by ID:

When    GET http://localhost:3000/api/notes/NOTE_ID is requested with USER_A's session cookie

Then    the response status is 200
        and the response body has the shape `{ "note": { "id": "NOTE_ID", "title": "Select Me", "body": "", "folder_id": null, "created_at": "...", "updated_at": "..." } }`
        and the `body` field is present (not omitted as it is in the list response)

Step 3 — In the browser at http://localhost:5173, log in as USER_A:

When    the user navigates to the workspace

Then    the sidebar on the left shows the note titled "Select Me"

When    the user clicks "Select Me" in the sidebar

Then    the editor area (center panel) changes from "Select or create a note to start editing" to displaying the note body
        and "Select Me" is highlighted in the sidebar with a blue left border
        and the sidebar remains fully visible (it is not hidden or collapsed after selection)

---

## Scenario 4 — Cross-user isolation on GET /api/notes/:id

AC-3 [REQ-008] — ownership negative case

Given   USER_A owns a note with id NOTE_A_ID
        and USER_B is logged in with a separate session

When    GET http://localhost:3000/api/notes/NOTE_A_ID is requested with USER_B's session cookie

Then    the response status is 404
        and the response body is `{ "error": "Not found" }`
        — USER_B cannot read USER_A's note; resource existence is not disclosed

When    GET http://localhost:3000/api/notes/NOTE_A_ID is requested without any session cookie

Then    the response status is 401

---

## Scenario 5 — Creating a new note adds it to the sidebar immediately

AC-4 [REQ-008]

Given   USER_A is logged in and the workspace is open in the browser at http://localhost:5173
        and the sidebar shows at least one existing note

When    the user clicks the "New note" button in the sidebar

Then    a new note immediately appears at the top of the sidebar list (without a page reload)
        and the new note is highlighted as the active note (blue left border)
        and the editor area reflects the newly created note

At the API level:

When    POST http://localhost:3000/api/notes is requested with USER_A's session cookie and body `{ "title": "Brand New Note" }`

Then    the response status is 201
        and the response body contains `{ "note": { "id": "<uuid>", "title": "Brand New Note", "updated_at": "...", "created_at": "..." } }`

When    GET http://localhost:3000/api/notes is subsequently requested

Then    "Brand New Note" appears at position 0 (top of the list, newest first)

---

## Scenario 6 — Active note is visually highlighted in the sidebar

AC-5 [REQ-008]

Given   USER_A is logged in and the workspace shows at least two notes in the sidebar

When    the user clicks the first note in the sidebar

Then    that note has a visible blue left border (accent highlight)
        and no other note has the same border

When    the user clicks a different note in the sidebar

Then    the second note now has the blue left border
        and the previously selected note no longer has the border

When    the page is loaded fresh (no note has been clicked yet)

Then    no note in the sidebar has the active highlight applied

---

## Scenario 7 — Sidebar layout at desktop viewport

AC-1 [REQ-008]

Given   the workspace is open in a browser window at >= 1024px width

When    the workspace page renders

Then    three panels are simultaneously visible:
        - leftmost column: the note catalog sidebar (260px wide)
        - centre column: the editor area
        - rightmost column: the preview area
        and the sidebar includes the user's note list and a "New note" button
        and no horizontal scrollbar is visible on the workspace

---

## Scenario 8 — Empty state when user has no notes

AC-1/AC-2 [REQ-008] — empty state

Given   USER_A has no notes (either a fresh account or all notes deleted)

When    the workspace is opened

Then    the sidebar does not display any note items
        and an empty-state message is shown guiding the user to create their first note
        and the "New note" button is still visible and functional
