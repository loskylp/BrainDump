# Demo Script — TASK-026: Export notes as Markdown

**Task:** TASK-026
**Requirement:** REQ-019 — Export notes as Markdown
**Environment:** Staging — https://braindump.staging.nxlabs.cc
**Date:** 2026-03-21

---

## Scenario 1: Happy path — export with a standard title

Given   | An authenticated user with a note titled "My Research Notes" containing Markdown body text (e.g., `# Heading`, bullet points, bold text)
When    | The user clicks the **Export** button in the editor toolbar
Then    | The browser downloads a file named `my-research-notes.md` containing the exact raw Markdown source (not rendered HTML); open the file in a text editor to confirm

---

## Scenario 2: Filename sanitization — special characters in title

Given   | An authenticated user with a note titled "Notes: Week 3 (Draft!)"
When    | The user clicks the **Export** button
Then    | The browser downloads a file named `notes-week-3-draft.md` — the colon, space, parentheses, and exclamation mark are removed or replaced; no special characters appear in the filename

---

## Scenario 3: Empty body — export does not fail

Given   | An authenticated user with a note that has a title but an empty body
When    | The user clicks the **Export** button
Then    | The browser downloads a `.md` file (the download is not silently skipped); the file size is zero bytes or very small; no error message appears

---

## Scenario 4: No backend request during export

Given   | An authenticated user with a note open in the editor
When    | The user clicks the **Export** button (observe the browser DevTools Network tab before clicking)
Then    | No new HTTP request to `/api/` appears in the Network tab after the click; the download uses only the browser's local Blob mechanism

---

## Scenario 5: Export button placement in toolbar

Given   | An authenticated user who has selected a note from the sidebar
When    | The user looks at the editor toolbar above the text area
Then    | The toolbar shows: Save, History, Delete, and **Export** buttons side by side; the Export button is clearly labelled and has a consistent appearance with the other toolbar buttons

---

## Scenario 6: Long title truncation

Given   | An authenticated user with a note whose title is 150 characters long (e.g., "a" repeated 150 times)
When    | The user clicks the **Export** button
Then    | The downloaded filename stem is exactly 100 characters long followed by `.md` — no filesystem error or browser refusal; the file downloads successfully

---

## Scenario 7: Export button absent without an active note

Given   | An authenticated user who has just logged in and has not yet selected or created a note
When    | The user looks at the editor toolbar area
Then    | No Export button is visible — the toolbar controls (Save, History, Delete, Export) only appear once a note is active in the editor

---

## Notes for the Nexus

- Verify Scenario 4 in Chrome DevTools: open the Network tab, filter by Fetch/XHR, then click Export. Confirm zero new requests appear.
- For Scenario 2, the exact output filename `notes-week-3-draft.md` should appear in the browser's download bar or Downloads folder without any special characters.
- OBS-026-02 (open question): when the body is empty (Scenario 3), the current implementation downloads a zero-byte `.md` file rather than one pre-populated with the title as a heading. If the Nexus prefers the title-as-heading behaviour, a follow-up task is needed.
