# TASK-025 Builder Handoff Note

**Task:** TASK-025 — Keyboard shortcuts
**Date:** 2026-03-21
**Builder iteration:** 1 (first pass)
**Commit:** `TASK-025: Keyboard shortcuts — all tests pass`

---

## What was built

### 1. `frontend/src/hooks/useKeyboardShortcuts.js` — stub replaced with full implementation

A custom hook that registers a single `keydown` listener on `document` and dispatches to the correct callback based on the key combination. Cleans up on unmount.

Shortcuts implemented:
- `Cmd/Ctrl+S` — calls `onSave`. Fires even when the target is `INPUT` or `TEXTAREA` (editor exception per spec).
- `Cmd/Ctrl+N` — calls `onNewNote`. Same editor exception as `onSave`.
- `Cmd/Ctrl+K` — calls `onFocusSearch`. Suppressed in typing contexts (INPUT, TEXTAREA, contenteditable).
- `?` — calls `onToggleShortcutRef`. Suppressed in typing contexts.
- `Escape` — calls `onEscape`. Fires from any context.

Browser-reserved shortcuts (`Cmd/Ctrl+W`, `T`, `L`, `R`, `Tab`) are not handled by the hook — browser defaults are preserved.

The `isTypingContext` helper checks `tagName === 'INPUT'`, `tagName === 'TEXTAREA'`, and `isContentEditable === true` OR `getAttribute('contenteditable') !== null && !== 'false'` (the getAttribute fallback handles detached elements in unit test environments where `isContentEditable` may be `undefined`).

### 2. `frontend/src/components/common/ShortcutReference.jsx` — stub replaced with full implementation

A modal overlay panel rendering all five shortcuts in a `<table>`. Returns `null` when `isOpen` is false. Features:
- `role="dialog"`, `aria-modal="true"`, `aria-label="Keyboard shortcuts"`
- Close button with `aria-label="Close keyboard shortcuts"`
- Semi-transparent backdrop that closes the overlay on click
- Own `keydown` listener for Escape (so it works independently of the parent hook)
- Focuses the close button on open for keyboard users

Shortcut entries shown: Cmd/Ctrl+S (Save note), Cmd/Ctrl+N (New note), Cmd/Ctrl+K (Focus search), ? (Show/hide shortcuts), Esc (Close panel / close sidebar).

### 3. `frontend/src/pages/WorkspacePage.jsx` — wired

- Imported `useKeyboardShortcuts` and `ShortcutReference`
- Added `showShortcutRef` state (default: `false`)
- Removed the former standalone `useEffect` blocks for Cmd+S and Escape — both are now handled by `useKeyboardShortcuts` to prevent double-registration
- Defined four new stable `useCallback` handlers at the top level of the component function:
  - `handleShortcutSave` — calls `handleSave()` when a note is active
  - `handleShortcutFocusSearch` — uses `document.querySelector('[aria-label="Search notes"]')` to focus the search input (see deviation note below)
  - `handleShortcutToggleRef` — toggles `showShortcutRef`
  - `handleShortcutEscape` — closes shortcut overlay first, then sidebar overlay
- Wired `useKeyboardShortcuts` with these callbacks plus `handleCreateNote` for `onNewNote`
- Rendered `<ShortcutReference isOpen={showShortcutRef} onClose={...} />` as a fixed overlay outside the grid
- Added a `?` button (`data-testid="shortcut-ref-button"`) in the top-right corner for discoverability

### 4. Unit tests

**`frontend/src/__tests__/useKeyboardShortcuts.test.js`** — 24 tests:
- Each shortcut fires the correct callback (Cmd+S, Ctrl+S, Cmd+N, Ctrl+N, Cmd+K, Ctrl+K, ?, Escape)
- Editor exception: Cmd+S and Cmd+N fire even with INPUT/TEXTAREA target
- Suppression: Cmd+K and ? do NOT fire with INPUT/TEXTAREA/contenteditable target
- Browser-reserved shortcuts (W, T, L, R) trigger no handler
- No throw when callbacks are omitted
- `removeEventListener` is called on unmount
- No callbacks fire after unmount

**`frontend/src/__tests__/ShortcutReference.test.jsx`** — 14 tests:
- Renders when `isOpen=true`, renders nothing when `isOpen=false`
- `role="dialog"`, `aria-label`, `aria-modal` attributes present
- All five shortcuts appear in the rendered content
- Close button calls `onClose`
- Escape key calls `onClose` when open
- Escape key does NOT call `onClose` when closed

---

## Deviations from the task specification

### 1. `onFocusSearch` uses DOM query, not a forwarded ref

The task specification says: "onFocusSearch: a new ref-based focus call to the SearchBar input (add a ref to SearchBar)."

The existing `WorkspaceSearch.test.jsx` mocks `SearchBar` as a plain function component (not `forwardRef`). When `ref` is passed to a plain function component in React 18, the component is called with `props = undefined` in some internal paths, which caused `capturedSearchBarProps` to be set to `undefined` — breaking the existing test with `TypeError: Cannot read properties of undefined (reading 'onResults')`.

Decision: use `document.querySelector('[aria-label="Search notes"]').focus()` instead of a forwarded ref. This is functionally equivalent in the browser (the SearchBar input already has `aria-label="Search notes"`) and does not break any existing test. The real `SearchBar` component already implements `forwardRef` and could support a ref if the existing `WorkspaceSearch` test mock were updated to match — but modifying an out-of-scope test to fix an issue my implementation introduced is outside my mandate.

The `onFocusSearch` callback works correctly in the real browser because the input is always in the DOM when the workspace is active.

### 2. `onToggleShortcutRef` name (not `onShowHelp` or `onToggleHelp`)

The stub used `onShowHelp`. The task wiring spec uses `onToggleShortcutRef`. I used `onToggleShortcutRef` as specified in the wiring section, which is more accurately named (it toggles, not just shows).

### 3. Escape handler: shortcut overlay takes priority over sidebar

When both `showShortcutRef` and `sidebarOpen` are true and Escape is pressed, the shortcut overlay closes first. This is the natural priority order: the most recently opened overlay should close first. This was not explicitly specified.

### 4. `ShortcutReference` has its own Escape listener

The component registers its own Escape listener so it can close itself even if `onEscape` is not connected through `useKeyboardShortcuts`. This ensures the overlay is always closeable and avoids tight coupling between the component and the hook wiring in `WorkspacePage`.

---

## Known limitations

- `handleShortcutFocusSearch` uses a live DOM query. If the SearchBar input is not in the DOM (e.g., sidebar is hidden on mobile), focus will silently no-op. This is acceptable: on mobile, the sidebar is either overlaid or the user is on the editor panel; in both cases the SearchBar is reachable via the sidebar toggle first.
- The `?` button in the top-right corner may overlap with other UI elements on very narrow viewports. No layout conflict was observed in testing; this can be adjusted in a future responsive pass.

---

## Test results

**Frontend (Vitest):**
- 40 test files, 441 tests — all pass
- 24 new tests in `useKeyboardShortcuts.test.js` — all pass
- 14 new tests in `ShortcutReference.test.jsx` — all pass
- All pre-existing tests continue to pass (no regressions)

**Backend (Jest):**
- 21 test suites, 252 tests — all pass (unaffected by this task)
