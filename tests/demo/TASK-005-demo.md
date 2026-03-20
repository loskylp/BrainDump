# Demo Script — TASK-005
**Task:** Ownership guard middleware and data isolation
**Requirement:** REQ-011 — Per-user data isolation
**Date:** 2026-03-20
**Environment:** Local development (http://localhost:3000)

Prerequisites: PostgreSQL running, backend started (`docker-compose -f docker-compose.dev.yml up`). Two distinct user accounts available — referred to as User A and User B below. A note and a folder owned by User B must exist in the database; their UUIDs are referred to as `NOTE_B_ID` and `FOLDER_B_ID`.

---

## Scenario 1 — Unauthenticated requests are blocked at all resource routes

AC-1 [REQ-011]

Given   no session cookie is present in the request

When    any of the following requests is sent without a session:
        - GET http://localhost:3000/api/notes/{any-uuid}
        - PUT http://localhost:3000/api/notes/{any-uuid}
        - DELETE http://localhost:3000/api/notes/{any-uuid}
        - GET http://localhost:3000/api/notes/{any-uuid}/versions
        - POST http://localhost:3000/api/notes/{any-uuid}/check-version
        - GET http://localhost:3000/api/folders/{any-uuid}
        - PUT http://localhost:3000/api/folders/{any-uuid}
        - DELETE http://localhost:3000/api/folders/{any-uuid}

Then    each response is HTTP 401
        and the body is `{ "error": "Authentication required" }`
        and no resource data is returned in any response

---

## Scenario 2 — The resource owner's requests pass the ownership guard

AC-2 [REQ-011]

Given   User A is logged in and has an active session cookie
        and User A owns a note with id NOTE_A_ID
        and User A owns a folder with id FOLDER_A_ID

When    User A sends GET http://localhost:3000/api/notes/{NOTE_A_ID}
When    User A sends GET http://localhost:3000/api/notes/{NOTE_A_ID}/versions
When    User A sends GET http://localhost:3000/api/folders/{FOLDER_A_ID}

Then    each response is HTTP 500 (the route handler stub has not yet been implemented — TASK-013/TASK-009 scope)
        and the response is NOT HTTP 401 and NOT HTTP 404
        confirming the ownership guard passed and execution reached the handler

---

## Scenario 3 — Cross-user resource access returns 404, not 403

AC-3 / AC-5 [REQ-011]

Given   User A is logged in
        and User B owns a note with id NOTE_B_ID
        and User B owns a folder with id FOLDER_B_ID

When    User A sends GET http://localhost:3000/api/notes/{NOTE_B_ID}
When    User A sends PUT http://localhost:3000/api/notes/{NOTE_B_ID}  (body: `{ "title": "hijack" }`)
When    User A sends DELETE http://localhost:3000/api/notes/{NOTE_B_ID}
When    User A sends GET http://localhost:3000/api/notes/{NOTE_B_ID}/versions
When    User A sends POST http://localhost:3000/api/notes/{NOTE_B_ID}/check-version
When    User A sends GET http://localhost:3000/api/folders/{FOLDER_B_ID}
When    User A sends PUT http://localhost:3000/api/folders/{FOLDER_B_ID}
When    User A sends DELETE http://localhost:3000/api/folders/{FOLDER_B_ID}

Then    each response is HTTP 404
        and the body is exactly `{ "error": "Not found" }` with no additional fields
        and no response returns HTTP 403
        confirming the guard does not reveal whether a resource exists at all
        and User B's note and folder remain unchanged in the database

---

## Scenario 4 — Sequelize forUser scope isolates records at the model layer

AC-4 / AC-6 [REQ-011]

Given   User A has 3 notes and 1 folder in the database
        and User B has 2 notes and 1 folder in the database

When    the application queries notes using Note.scope('forUser') with User A's userId
Then    exactly User A's 3 notes are returned and User B's notes are absent

When    the application queries folders using Folder.scope('forUser') with User A's userId
Then    exactly User A's 1 folder is returned and User B's folder is absent

When    the application queries notes for a userId that owns no records
Then    an empty array is returned (not null, not an error)

---

## Scenario 5 — Row Level Security is structurally active on all protected tables

AC-7 [REQ-011]

Given   a direct PostgreSQL connection to the development database

When    the RLS configuration is inspected for the notes, folders, and note_versions tables

Then    all three tables have rowsecurity = true
        and all three tables have relforcerowsecurity = true (FORCE ROW LEVEL SECURITY)
        and at least one RLS policy exists on each table
        and the notes table policy references current_setting('app.current_user_id')
        confirming the database enforces isolation even if the application layer were bypassed
