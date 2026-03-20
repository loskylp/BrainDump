# Demo Script — TASK-007: Split-pane Markdown editor with live preview

**Task:** TASK-007
**Date:** 2026-03-20
**Environment:** Staging — https://braindump.staging.nxlabs.cc

---

## Prerequisites

- Staging environment is running and reachable
- A registered user account exists (use an existing account or register one via `/register`)
- You are logged in to the workspace

---

## Scenario 1 — Two panels are visible side by side (AC-1)

Given   | An authenticated user is logged in to the workspace at `/workspace`
When    | The workspace renders with no note selected
Then    | **Verify both panels are visible simultaneously:**

- Left panel: a dark-background code editor (CodeMirror) — background is near-black (#1E1E1E)
- Right panel: a white/light-background preview area — background is white (#FFFFFF)
- A 1px vertical divider line separates the two panels — no shadow, no gradient
- The editor is empty (no note selected)

---

## Scenario 2 — Markdown editor has monospace font in a dark panel (AC-4, AC-6)

Given   | An authenticated user is at the workspace with the editor visible
When    | The user clicks into the editor panel and observes the font and colours
Then    | **Verify the following editor characteristics:**

- Font is monospace (JetBrains Mono, Fira Code, or system monospace fallback)
- Font size is approximately 14px
- Editor background is dark (dark grey / near-black)
- Markdown syntax is highlighted — type the following to confirm:

```
# My Note Heading

Some **bold** text and *italic* text.

- item one
- item two

[a link](https://example.com)
```

- The `#` prefix should appear in a distinct colour from the heading text
- `**bold**` asterisks should be highlighted differently from the surrounding text
- The unordered list dashes and the link brackets should be visually distinguished from plain prose

---

## Scenario 3 — Live preview with no perceptible delay (AC-2, AC-3 / FF-D02)

Given   | An authenticated user is in the workspace with a note open (or the editor empty)
When    | The user types Markdown source into the editor panel, character by character
Then    | **Verify the preview panel updates with no perceptible delay:**

Step 1: Type `# ` (hash space) — the right panel should immediately show a large heading-style text element
Step 2: Continue typing `Hello World` — the heading text updates with each keystroke
Step 3: Press Enter twice and type `**bold text**` — bold text appears in the right panel as it is typed
Step 4: Press Enter twice and type `- item one` then Enter `- item two` — a bullet list appears in the right panel

The user must NOT need to press a Save button, Refresh button, or any other control to see the preview update. The preview updates on every keystroke.

---

## Scenario 4 — CommonMark rendering correctness (AC-5)

Given   | An authenticated user is in the workspace with the editor active
When    | The user clears the editor and types the following complete Markdown document:

```
# Main Heading

A paragraph with **bold** and *italic* text.

## Section Two

- item one
- item two
- item three

1. first
2. second

Inline `code` example.

```javascript
const x = 1;
```

[A link](https://example.com)
```

Then    | **Verify the preview panel renders each element correctly:**

- `# Main Heading` renders as a large heading (h1-equivalent)
- `## Section Two` renders as a smaller heading (h2-equivalent)
- `**bold**` renders as visually bold text
- `*italic*` renders as visually italic text
- The three unordered items render as a bullet list
- The two ordered items render as a numbered list
- `` `code` `` renders as inline monospace code
- The fenced code block renders as a monospace code block
- `[A link](https://example.com)` renders as a clickable hyperlink with the text "A link"

---

## Scenario 5 — Preview uses light background with system font (AC-7)

Given   | A note with Markdown prose is open in the workspace
When    | The user observes the preview panel
Then    | **Verify the preview panel characteristics:**

- Background is white or near-white — clearly lighter than the editor panel
- Prose text uses a sans-serif system font (not monospace)
- Code blocks within the rendered preview use a monospace font (correct contrast)
- The 16px padding is visible — text does not press against the panel edge

---

## Scenario 6 — Panel divider is a thin border line (AC-8)

Given   | The workspace is rendered with both panels visible
When    | The user inspects the visual boundary between the editor and preview panels
Then    | **Verify the panel divider appearance:**

- The boundary between the editor and preview panels is a single thin line (1px)
- There is no drop shadow on either side of the divider
- There is no gradient blending between the dark editor and the light preview
- The line colour matches the border colour token (light grey, approximately #DEE2E6)

---

## Scenario 7 — Selecting a note loads its body into both editor and preview (AC-2, integration)

Given   | An authenticated user has at least one existing note with a Markdown body
When    | The user clicks the note title in the sidebar catalog
Then    | **Verify the editor and preview both load the note body:**

- The editor panel displays the raw Markdown source of the note
- The preview panel simultaneously displays the rendered HTML of the same note body
- No additional action is required — the panels update on note selection

---

## Scenario 8 — XSS safety: raw HTML in note source is escaped (AC-5 security)

Given   | An authenticated user is in the workspace editor
When    | The user types a raw HTML script tag: `<script>alert('test')</script>`
Then    | **Verify the preview does not execute the script:**

- No alert dialog appears
- The preview panel shows the text `<script>alert('test')</script>` as escaped plain text (with visible angle brackets), or shows nothing, but does NOT execute the script
- The page does not navigate away or show a JavaScript alert
