# Demo Script — TASK-030: Reading mode

**Task:** TASK-030 — Reading mode
**Requirement:** REQ-022 — Reading mode
**Date:** 2026-03-21
**Environment:** Staging — https://braindump.staging.nxlabs.cc

---

## Prerequisites

- A registered and logged-in user account exists
- At least two notes are present in the account (for navigation scenarios)
- One note has rich Markdown content: headings, bold/italic text, a code block, and a list

---

## Scenario 1 — Enter reading mode via the toolbar button

Verifies: AC-1, AC-2, AC-3, AC-4

Given   | A logged-in user is in the workspace with a Markdown note open in the split-pane editor
When    | The user clicks the "Read" button in the editor toolbar (visible alongside Save, History, Delete, Export)
Then    | The split-pane editor and sidebar disappear; the note's rendered Markdown content is displayed in a centered, full-width reading layout; only the minimal toolbar is visible (exit button, note title, Prev/Next navigation)

---

## Scenario 2 — Exit reading mode via the exit button

Verifies: AC-4, AC-6

Given   | A logged-in user is in reading mode
When    | The user clicks the "Exit" button in the reading toolbar
Then    | Reading mode closes; the full workspace is restored (sidebar + split-pane editor + preview panel); the same note is still open and active in the editor

---

## Scenario 3 — Exit reading mode via Escape

Verifies: AC-6

Given   | A logged-in user is in reading mode
When    | The user presses the Escape key
Then    | Reading mode closes and the full workspace is restored with the same note active

---

## Scenario 4 — Toggle reading mode via Cmd/Ctrl+Shift+R

Verifies: AC-5

Given   | A logged-in user is in the workspace with a note open
When    | The user presses Cmd+Shift+R (macOS) or Ctrl+Shift+R (Windows/Linux)
Then    | Reading mode activates; the editor chrome disappears and the note renders in the reading layout
When    | The user presses Cmd+Shift+R (or Ctrl+Shift+R) again
Then    | Reading mode deactivates and the full workspace is restored

---

## Scenario 5 — Navigate to the next note within reading mode

Verifies: AC-7, AC-8

Given   | A logged-in user is in reading mode viewing a note that is not the last in catalog order
When    | The user clicks the "Next" button in the reading toolbar
Then    | The next note (by last-modified order) is loaded and displayed in reading mode; the user has not returned to the workspace; the title in the toolbar updates to the new note's title
When    | The user clicks "Next" while viewing the last note in the catalog
Then    | The "Next" button is disabled and clicking it has no effect

---

## Scenario 6 — Navigate to the previous note within reading mode

Verifies: AC-7, AC-8

Given   | A logged-in user is in reading mode viewing a note that is not the first in catalog order
When    | The user clicks the "Prev" button in the reading toolbar
Then    | The previous note is loaded and displayed in reading mode without leaving the reading view
When    | The user is viewing the first note in the catalog
Then    | The "Prev" button is disabled and cannot be clicked

---

## Scenario 7 — Rendered Markdown content matches the preview panel

Verifies: AC-9

Given   | A logged-in user opens a note with rich Markdown (headings, bold, italic, code block, list)
When    | The user enters reading mode
Then    | The rendered content is visually identical to the split-pane preview panel: headings render as headings, bold text is bold, code blocks are displayed in a monospace code style, list items are bulleted; the same CommonMark rules apply to both panels

---

## Scenario 8 — Professional reading layout (ADR-008 aesthetic)

Verifies: AC-10

Given   | A logged-in user is in reading mode
When    | The user evaluates the visual layout
Then    | The content is centered in a column with a max-width of approximately 720px; generous top and bottom padding creates comfortable reading space; the toolbar uses the monospace font and design tokens (dark background, border separator, no shadows or rounded corners beyond the established design system); the aesthetic is consistent with the rest of the workspace

---

## Scenario 9 — Reading mode is unavailable without an active note

Verifies: AC-1, AC-11

Given   | A logged-in user is in the workspace with no note selected
When    | The user looks at the editor area
Then    | The "Read" button is not visible (it only appears when a note is open)
When    | The user presses Cmd+Shift+R with no note selected
Then    | Nothing happens; reading mode is not activated because there is no note content to display
