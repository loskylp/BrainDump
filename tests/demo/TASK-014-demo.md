# Demo Script — TASK-014: Full-Text Search

**Task:** TASK-014
**Requirement:** REQ-014 — Full-text search across user notes (GIN index, PostgreSQL tsvector)
**Environment:** Staging — https://braindump.staging.nxlabs.cc
**Date:** 2026-03-21
**Prerequisites:** An authenticated user account with at least one note containing searchable content. Open the workspace at `/workspace` before starting each scenario.

---

## Scenario 1 — Search bar is visible in the workspace sidebar (AC-6)

Given   | A logged-in user is on the workspace at `/workspace`
When    | The user looks at the sidebar panel
Then    | A search input field is visible above the note catalog list
        | The placeholder text indicates a search affordance (e.g. "Search notes…")

---

## Scenario 2 — Happy path: query returns matching notes (AC-1, AC-2)

Given   | An authenticated user with a note whose body contains "The quick brown fox jumps over the lazy dog"
When    | The user types "quick fox" into the search bar and submits (Enter or debounced trigger)
Then    | The note catalog is replaced by a search results list
        | The matching note title appears in the results
        | The result snippet highlights the matched terms (e.g. `<mark>quick</mark>` … `<mark>fox</mark>`)

Screenshot: `01-search-results.png`

---

## Scenario 3 — Empty query is rejected (AC-4)

Given   | A logged-in user on the workspace
When    | The user submits an empty or whitespace-only query string
Then    | No API request is fired (or the API returns 400 with `EMPTY_QUERY`)
        | The note catalog continues to display normally; no error overlay appears

---

## Scenario 4 — No results returns empty state (AC-3)

Given   | A logged-in user whose notes contain no text matching the query "zzznomatch"
When    | The user types "zzznomatch" into the search bar
Then    | The results area displays a "No notes found" message
        | No crash, modal, or redirect occurs

Screenshot: `02-no-results.png`

---

## Scenario 5 — Clicking a search result opens the note in the editor (AC-5)

Given   | A logged-in user who has performed a search and at least one result is shown
When    | The user clicks a result in the search result list
Then    | The note is loaded into the editor panel (title and body appear)
        | The search results view is dismissed (catalog returns or editor takes focus)

Screenshot: `03-result-opens-note.png`

---

## Scenario 6 — API endpoint shape (AC-1)

Given   | A terminal with curl and a valid session cookie
When    | The request `GET /api/search?q=quick+fox` is sent with the session cookie
Then    | The response is HTTP 200 with body `{ "results": [ { "id": "...", "title": "...", "snippet": "..." } ] }`
        | The snippet field contains `<mark>` highlight tags

**Steps:**

```sh
curl -s "https://braindump.staging.nxlabs.cc/api/search?q=quick+fox" \
  -H "Cookie: connect.sid=<session-cookie>"
```

Expected response shape:

```json
{
  "results": [
    {
      "id": "<uuid>",
      "title": "...",
      "snippet": "…<mark>quick</mark>…<mark>fox</mark>…"
    }
  ]
}
```

---

## Scenario 7 — Empty query returns 400 (AC-4)

Given   | A terminal with curl and a valid session cookie
When    | The request `GET /api/search?q=` is sent
Then    | The response is HTTP 400 with body `{ "error": "EMPTY_QUERY" }`

---

## Notes for the Nexus

- Search results are scoped strictly to the authenticated user's notes — other users' notes are never returned (RLS enforcement).
- The GIN index (FF-D24) ensures queries complete in under 200ms for collections up to 200 notes (validated separately in TASK-020).
- Clearing the search bar returns the sidebar to the full note catalog view.
