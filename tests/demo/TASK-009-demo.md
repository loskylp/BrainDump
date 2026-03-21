# Demo Script -- TASK-009: Edit a note (API and editor integration)
**Task:** TASK-009
**Date:** 2026-03-21
**Environment:** Staging or local development (backend + frontend running)
**Prerequisites:** A registered and logged-in user. At least one note exists in the catalog. Use the registration flow (TASK-003) if starting fresh.

---

## Scenario 1 -- Save a note using the Save button (AC-1, AC-2, AC-3)

Given   | The authenticated user has at least one note in the sidebar catalog
When    | The user clicks the note title in the sidebar to open it
Then    | The title input at the top of the editor is populated with the note's persisted title, and the CodeMirror editor shows the note's persisted body content

When    | The user edits the title (clears it and types "My Edited Note")
And     | The user edits the body (types some Markdown: `# Hello\n\nThis is **edited** content.`)
And     | The user clicks the **Save** button in the editor toolbar
Then    | The save completes without error (no visible error indicator)

When    | The user navigates away (clicks a different note) and then clicks back to the edited note
Then    | The title input shows "My Edited Note" and the body shows the Markdown that was typed, confirming persistence

When    | The user checks the note's entry in the sidebar catalog
Then    | The sidebar entry shows the updated title and a "last modified" timestamp that is more recent than before the save

---

## Scenario 2 -- Save a note using the keyboard shortcut (AC-3)

Given   | The authenticated user has a note open in the editor
When    | The user edits the body (adds a line of text)
And     | The user presses **Cmd+S** (macOS) or **Ctrl+S** (Windows/Linux)
Then    | The save completes without error (no visible error indicator in this iteration -- silent success is expected)

When    | The user navigates away and returns to the same note
Then    | The change made before pressing the keyboard shortcut is present in the editor

---

## Scenario 3 -- Cross-user ownership enforcement (AC-4)

Given   | User A is logged in and has a note with a known ID
When    | User B (logged in as a different account) sends `PUT /api/notes/<User A's note ID>` directly via curl or Postman with a session cookie belonging to User B
Then    | The API responds with HTTP 404 `{ "error": "Not found" }`

When    | User A loads their note again
Then    | The note's title and body are unchanged -- User B's write attempt had no effect

---

## Scenario 4 -- Editor loads existing content when selecting a note (AC-5)

Given   | The user has previously saved a note with title "Meeting Notes" and body containing several paragraphs of Markdown
When    | The user selects a different note in the sidebar and then clicks "Meeting Notes" again
Then    | The title input immediately shows "Meeting Notes"
And     | The CodeMirror editor shows the full Markdown body that was previously saved
And     | The Preview panel on the right renders the Markdown as HTML in real time (TASK-007 live preview)

When    | The user selects a second note
Then    | The title input and editor body update to reflect the second note's persisted content (not the first note's content)

---

## API verification (optional -- for technical review)

Run the following from a terminal to verify the endpoint directly.

Register and log in to obtain a session cookie, then:

    # Create a note
    curl -s -X POST http://localhost:3000/api/notes \
      -H 'Content-Type: application/json' \
      -b <session-cookie> \
      -d '{"title":"Demo Note"}' | jq .

    # Note the returned "id" field. Use it in the next call:
    NOTE_ID=<id from above>

    # Update the note
    curl -s -X PUT http://localhost:3000/api/notes/$NOTE_ID \
      -H 'Content-Type: application/json' \
      -b <session-cookie> \
      -d '{"title":"Updated Demo Note","body":"# Updated\n\nContent here."}' | jq .

    # Verify the response has: note.title = "Updated Demo Note", note.body contains the Markdown,
    # note.updated_at is an ISO 8601 timestamp

    # Reload the note via GET to confirm persistence
    curl -s http://localhost:3000/api/notes/$NOTE_ID \
      -b <session-cookie> | jq .note.title,.note.body
