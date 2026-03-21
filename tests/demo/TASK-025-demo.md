# Demo Script — TASK-025: Keyboard Shortcuts

**Task:** TASK-025
**Requirement:** REQ-025 — Keyboard shortcuts: Cmd+S save, Cmd+N new note, Cmd+K search focus, Cmd+B bold, Cmd+I italic, ? overlay, Escape close
**Environment:** Staging — https://braindump.staging.nxlabs.cc
**Date:** 2026-03-21
**Prerequisites:** An authenticated user account with at least one existing note. Open the workspace at `/workspace` before starting each scenario.

---

## Scenario 1 — Press ? to open the keyboard shortcut reference overlay (AC-7)

Given   | A logged-in user is on the workspace at `/workspace` with focus NOT in a text input
When    | The user presses the "?" key
Then    | A modal overlay (ShortcutReference) appears listing all available keyboard shortcuts
        | The overlay is centred or positioned clearly over the workspace content
        | It lists shortcuts including Cmd+S, Cmd+N, Cmd+K, Cmd+B, Cmd+I, and ?/Escape

Screenshot: `01-shortcut-overlay-open.png`

---

## Scenario 2 — Press Escape to close the keyboard shortcut overlay (AC-7)

Given   | The keyboard shortcut overlay is open (from Scenario 1)
When    | The user presses the Escape key
Then    | The overlay closes and the workspace is visible again
        | No note data is lost or modified

Screenshot: `02-shortcut-overlay-closed.png`

---

## Scenario 3 — Cmd+N creates a new note (AC-2)

Given   | A logged-in user is on the workspace
When    | The user presses Cmd+N (Mac) or Ctrl+N (Windows/Linux)
Then    | A new untitled note is created and added to the top of the note catalog
        | The editor is focused on the new note's title field
        | The editor body is empty

Screenshot: `03-new-note-created.png`

---

## Scenario 4 — Cmd+S saves the current note (AC-1)

Given   | A logged-in user has a note open in the editor with unsaved changes
When    | The user presses Cmd+S (Mac) or Ctrl+S (Windows/Linux)
Then    | The note is saved (PUT /api/notes/:id is called)
        | A save confirmation indicator appears briefly (e.g. "Saved" status text)
        | The browser does not open the native "Save page as" dialog

Screenshot: `04-note-saved.png`

---

## Scenario 5 — Cmd+K focuses the search bar (AC-3)

Given   | A logged-in user is on the workspace with focus anywhere other than the search bar
When    | The user presses Cmd+K (Mac) or Ctrl+K (Windows/Linux)
Then    | The search bar in the sidebar receives keyboard focus
        | A cursor appears in the search input ready for typing

Screenshot: `05-search-focused.png`

---

## Scenario 6 — Cmd+B inserts bold Markdown markers (AC-4)

Given   | A logged-in user has a note open in the editor
When    | The user places the cursor in the editor body (or selects some text)
        | The user presses Cmd+B (Mac) or Ctrl+B (Windows/Linux)
Then    | Bold Markdown markers `**` are inserted around the selected text, or an empty `****` pair is inserted at the cursor
        | The preview panel (if visible) shows the text rendered as bold

Screenshot: `06-bold-markers-inserted.png`

---

## Scenario 7 — Cmd+I inserts italic Markdown markers (AC-5)

Given   | A logged-in user has a note open in the editor body
When    | The user places the cursor or selects text and presses Cmd+I (Mac) or Ctrl+I (Windows/Linux)
Then    | Italic Markdown markers `_` (or `*`) are inserted around the selected text or at the cursor

Screenshot: `07-italic-markers-inserted.png`

---

## Scenario 8 — Keyboard shortcuts do not fire when focus is in an input or textarea (AC-6 non-regression)

Given   | A logged-in user is typing in the note title input field
When    | The user presses "?"
Then    | The character "?" is typed into the title field — the shortcut overlay does NOT open

Given   | A logged-in user is typing in the editor body textarea
When    | The user presses "?"
Then    | The character "?" is typed into the body — the shortcut overlay does NOT open

---

## Notes for the Nexus

- Keyboard shortcuts use the `useKeyboardShortcuts` hook, which guards against firing inside `INPUT`, `TEXTAREA`, and `SELECT` elements.
- On macOS, the modifier key is Cmd (Meta). On Windows/Linux, it is Ctrl. The hook listens for both.
- The ShortcutReference component (`frontend/src/components/common/ShortcutReference.jsx`) renders the overlay.
- Pressing Escape also closes the search bar if it is focused and the results dropdown is open (separate from the overlay close behaviour).
