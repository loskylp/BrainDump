# Demo Script — TASK-006
**Task:** Create a note with persistence
**Requirement:** REQ-004 — User can create a note
**Date:** 2026-03-20
**Environment:** Local development (http://localhost:3000)

Prerequisites: PostgreSQL running, backend started (`docker-compose -f docker-compose.dev.yml up`). A registered and logged-in user session is available — session cookie referred to below as `SESSION_COOKIE`. A second user account (User B) is available for ownership isolation scenarios.

---

## Scenario 1 — Authenticated user creates a note with a title

AC-1 [REQ-004]

Given   a logged-in user session (SESSION_COOKIE obtained after registration or login)

When    POST http://localhost:3000/api/notes is sent with body `{ "title": "My First Note" }` and the session cookie

Then    the response status is 201
        and the response body has the shape `{ "note": { "id": "<uuid>", "title": "My First Note", "body": "", "created_at": "<timestamp>", "updated_at": "<timestamp>" } }`

---

## Scenario 2 — Note is persisted in PostgreSQL with UUID, empty body, and timestamps

AC-2 [REQ-004 / REQ-012]

Given   the note was created in Scenario 1 and its `id` is known (referred to as `NOTE_ID`)

When    the notes table is queried: `SELECT id, title, body, created_at, updated_at FROM notes WHERE id = '<NOTE_ID>'`

Then    one row is returned
        and `id` is a UUID matching the response from Scenario 1
        and `body` is an empty string
        and `created_at` and `updated_at` are TIMESTAMPTZ values close to the current time

---

## Scenario 3 — Initial version (version_number=1) created atomically in note_versions

AC-3 [REQ-004 / FF-D16]

Given   the note was created in Scenario 1 (`NOTE_ID` known)

When    the note_versions table is queried: `SELECT note_id, title, body, version_number FROM note_versions WHERE note_id = '<NOTE_ID>'`

Then    exactly one row is returned
        and `version_number` is 1
        and `title` matches "My First Note"
        and `body` is an empty string
        — confirming the initial version was written atomically with the note row

---

## Scenario 4 — Duplicate titles are allowed

AC-4 [REQ-004]

Given   a logged-in user session

When    POST http://localhost:3000/api/notes is sent twice with the same body `{ "title": "Duplicate Title" }`

Then    both requests return 201
        and the two response `note.id` values are distinct UUIDs
        — confirming no title uniqueness constraint exists

---

## Scenario 5 — API response contains all required fields

AC-5 [REQ-004]

Given   a logged-in user session

When    POST http://localhost:3000/api/notes is sent with body `{ "title": "Field Check Note" }`

Then    the response is 201
        and `res.body.note` contains exactly these fields (at minimum): `id`, `title`, `body`, `created_at`, `updated_at`
        and `body` is `""`
        and `id` is a UUID (matches pattern `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
        and `created_at` and `updated_at` are valid ISO 8601 strings

---

## Scenario 6 — Note is accessible only to its owner

AC-6 [REQ-004 / REQ-011]

Given   User A creates a note (SESSION_COOKIE_A) and its `id` is `NOTE_A_ID`
        and User B is logged in with a separate session (SESSION_COOKIE_B)

When    User B sends GET http://localhost:3000/api/notes/`<NOTE_A_ID>` with SESSION_COOKIE_B

Then    the response is 404 with body `{ "error": "Not found" }`
        — User B cannot access User A's note; resource existence is not disclosed

When    User B sends DELETE http://localhost:3000/api/notes/`<NOTE_A_ID>` with SESSION_COOKIE_B

Then    the response is 404
        and querying the database confirms the note still exists

When    GET http://localhost:3000/api/notes/`<NOTE_A_ID>` is sent with no session cookie

Then    the response is 401 with body `{ "error": "Authentication required" }`
