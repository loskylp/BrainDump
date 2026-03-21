# Demo Script — TASK-029: Bulk ZIP export backend

**Task:** TASK-029
**Requirement:** REQ-020 — Full export to ZIP
**Environment:** Staging — https://braindump.staging.nxlabs.cc
**Date:** 2026-03-21

---

## Scenario 1: Export all notes including folder structure

Given   | An authenticated user who has at least 5 notes: 3 at root level and 2 in a folder named "Research" — each note has distinct Markdown body content
When    | The user triggers a GET request to `/api/notes/export` (e.g., via `curl -b <session-cookie> https://braindump.staging.nxlabs.cc/api/notes/export -o export.zip`)
Then    | The response status is 200; the file saved as `export.zip` is a valid ZIP archive; running `unzip -l export.zip` shows 3 `.md` files at the root and 2 `.md` files inside a `research/` subdirectory

---

## Scenario 2: ZIP filename includes username and date

Given   | An authenticated user logged in as `pablo`
When    | The user requests `GET /api/notes/export`
Then    | The `Content-Disposition` response header is: `attachment; filename="braindump-export-pablo-2026-03-21.zip"` (today's date in YYYY-MM-DD format); the filename does not contain another user's username

---

## Scenario 3: Each .md file contains raw Markdown (not rendered HTML)

Given   | An authenticated user with a note titled "Project Plan" containing `# Heading\n\n**bold text**`
When    | The user downloads the ZIP and opens `project-plan.md` from the archive in a text editor
Then    | The file content is the literal Markdown source `# Heading\n\n**bold text**` — no `<h1>`, `<strong>`, or other HTML tags are present; the content matches exactly what was saved in the editor

---

## Scenario 4: Filename collision resolved with numeric suffix

Given   | An authenticated user with two notes both titled "Meeting Notes" at root level
When    | The user downloads the ZIP
Then    | Running `unzip -l export.zip` shows `meeting-notes.md` and `meeting-notes-2.md` as separate entries at the ZIP root; each file contains the body of its corresponding note

---

## Scenario 5: Filename sanitization — unsafe characters removed

Given   | An authenticated user with a note titled "Q3: Results (Final!)" and a folder named "Client/Projects"
When    | The user downloads the ZIP
Then    | The note filename is `q3-results-final.md` (colon, spaces, parentheses, exclamation replaced/removed); the folder subdirectory is `client-projects/` (slash replaced with hyphen); running `unzip -l export.zip` confirms no special characters in any entry names

---

## Scenario 6: Export with zero notes returns a valid empty ZIP

Given   | A newly registered authenticated user who has not yet created any notes
When    | The user requests `GET /api/notes/export`
Then    | The response status is 200 with `Content-Type: application/zip`; saving the response body and running `unzip -l export.zip` shows "0 files" — the ZIP is valid and parseable, not a 0-byte file or an error response

---

## Scenario 7: Per-user isolation — export returns only the authenticated user's notes

Given   | Two users, Alice and Bob, each with notes in the system
When    | Alice requests `GET /api/notes/export` with her session cookie
Then    | The downloaded ZIP contains only Alice's notes — Bob's notes do not appear in the archive; confirm by checking that the note count in the ZIP matches Alice's note count in the sidebar

---

## Notes for the Nexus

- Scenarios 1–7 verify the backend endpoint only. The "Export All" button in the sidebar (AC-7 and AC-8) is deferred to a separate frontend task.
- For Scenario 2, the date in the filename will be today's date when the download is triggered; the format must be exactly `YYYY-MM-DD`.
- For Scenario 5, verify `unzip -l` output: no entry path should contain `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, or `|` characters.
- For Scenario 7, use two browser sessions (or separate curl invocations with different session cookies) to confirm isolation.
