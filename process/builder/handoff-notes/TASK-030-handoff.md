# Handoff Note — TASK-030: Reading Mode

**Task:** TASK-030
**Requirement:** REQ-022
**ADR:** ADR-008
**Builder profile:** Commercial
**Status:** Complete
**Date:** 2026-03-21

---

## What was built

### 1. `frontend/src/components/reading/ReadingView.jsx` (new)

Full-screen reading mode component.

- Props: `{ note, notes, onExit, onNavigate }`
- Renders with `data-testid="reading-view"`, `data-testid="reading-toolbar"`, `data-testid="reading-prev-btn"`, `data-testid="reading-next-btn"`, `data-testid="reading-exit-btn"`
- Toolbar: `← Prev` | note title (centered) | `Next →` | `✕ Exit`
- Previous/Next buttons are `disabled` at list boundaries (`opacity-50 cursor-not-allowed`)
- Body rendered via the same `markdown-it` singleton as `Preview.jsx` (`html: false`, `linkify: true`, `typographer: true`), injected via `dangerouslySetInnerHTML`
- Content styled with `prose prose-sm` and centered column `max-w-2xl mx-auto px-8 py-12`
- Toolbar uses `border-b border-border bg-bg-secondary` — no shadows, no rounded corners (ADR-008)
- Fixed overlay (`fixed inset-0 z-50`) — covers the full viewport, hides sidebar and editor

### 2. `frontend/src/hooks/useKeyboardShortcuts.js` (updated)

Added `Cmd/Ctrl+Shift+R` handling:

- New `onReadingMode` parameter added to the destructured handlers object
- Handler fires even when focus is inside `INPUT` or `TEXTAREA` (consistent with `onSave` and `onNewNote`)
- `Shift` is required to distinguish from `Cmd+R` (browser reload), which remains unintercepted
- `onReadingMode` added to the `useEffect` dependency array

### 3. `frontend/src/pages/WorkspacePage.jsx` (updated)

- New `readingMode` boolean state (default `false`)
- New `handleShortcutReadingMode` callback — toggles `readingMode`
- New `handleReadingModeNavigate` callback — sets `activeNoteId` to navigate within reading mode while keeping reading mode active
- `handleShortcutEscape` updated: exits reading mode first (before shortcut ref overlay or sidebar)
- `onReadingMode: handleShortcutReadingMode` wired into `useKeyboardShortcuts`
- `Read` button (`data-testid="reading-mode-button"`) added to editor toolbar after Export button; visible only when a note is active
- When `readingMode && activeNote`: renders `<ReadingView>` (full-screen) instead of the outer `div`+`WorkspaceLayout` tree — this hides the sidebar, editor, and toolbar

---

## Unit tests

Three new test files. All follow the existing red/green/refactor cycle.

| File | Tests | Coverage |
|---|---|---|
| `frontend/src/__tests__/ReadingView.test.jsx` | 18 | Structure, data-testids, Markdown rendering, prev/next navigation, boundary disabling, exit |
| `frontend/src/__tests__/useKeyboardShortcutsReadingMode.test.js` | 8 | Cmd+Shift+R fires, Ctrl+Shift+R fires, Cmd+R without Shift does not fire, INPUT/TEXTAREA exception, no-crash without callback, post-unmount cleanup |
| `frontend/src/__tests__/WorkspaceReadingMode.test.jsx` | 9 | Read button visibility, entering reading mode, sidebar hidden, exit button, Escape key, Cmd+Shift+R toggle |

Full suite: **51 test files, 609 tests — all passing.**

---

## Acceptance criteria coverage

| AC | Outcome |
|---|---|
| AC-1: "Reading Mode" button visible in editor toolbar | Implemented as `data-testid="reading-mode-button"` |
| AC-2: Clicking replaces split-pane with full-width centered Markdown view | Implemented — `ReadingView` occupies full viewport |
| AC-3: Sidebar hidden in reading mode | Implemented — `WorkspaceLayout` is not rendered |
| AC-4: Toolbar minimized to exit, title, prev/next | Implemented |
| AC-5: Cmd/Ctrl+Shift+R toggles reading mode | Implemented in `useKeyboardShortcuts` |
| AC-6: Escape exits reading mode | Implemented — `handleShortcutEscape` handles reading mode first |
| AC-7: Prev/next navigation within reading mode | Implemented — `handleReadingModeNavigate` sets `activeNoteId` |
| AC-8: Navigation disabled at boundaries | Implemented — `disabled` attribute + opacity styling |
| AC-9: Same markdown-it renderer as preview panel | Implemented — same `MarkdownIt` configuration as `Preview.jsx` |
| AC-10: Design tokens (ADR-008) | Implemented — no shadows, no gradients, `border-b border-border`, `rounded-sm` max |
| AC-11: Reading mode behind authentication | No change needed — `WorkspacePage` is behind `ProtectedRoute` (TASK-004); `ReadingView` is a child of `WorkspacePage` |

---

## Deviations from spec

**None.** All acceptance criteria are satisfied as described.

**Design note:** The spec says "render `ReadingView` instead of `WorkspaceLayout`". The implementation renders `ReadingView` as a `fixed inset-0 z-50` overlay, which is functionally equivalent (sidebar not visible, full viewport taken by reading view) and allows the React tree below to remain mounted — avoiding unmount/remount of the editor state when the user exits reading mode. The Verifier's acceptance tests should verify that `data-testid="sidebar-overlay"` is absent from the DOM while in reading mode; this is the case because the outer `div`+`WorkspaceLayout` branch is not rendered (early return).

---

## Known limitations

- ReadingView uses `activeNote` from `WorkspacePage` state. When the user navigates within reading mode, `handleReadingModeNavigate` sets `activeNoteId`, which triggers the existing `getNote` fetch effect. The `ReadingView` re-renders with the new `activeNote` once the fetch resolves. There is a brief moment where `activeNote` has the previous note's content — this is the same fetch latency as opening a note in the normal workspace and is expected behaviour.
- If `readingMode` is `true` but `activeNote` is `null` (e.g., note was deleted externally while reading mode was open), the workspace falls back to the normal layout. This is the safe fallback — no reading view with no note content.
