# Handoff Note — TASK-007: Split-pane Markdown editor with live preview (iteration 1)
**Iteration:** 1 of 3
**Date:** 2026-03-20
**Builder:** Claude Sonnet 4.6
**Status:** All acceptance criteria implemented — all tests pass

---

## What was built

This iteration implements the split-pane Markdown editor with live preview (REQ-007). The two stub components (`Editor.jsx`, `Preview.jsx`) that existed in `frontend/src/components/editor/` are now fully implemented. `WorkspacePage.jsx` is updated to wire both components into the workspace layout, replacing the placeholder text.

### `frontend/src/components/editor/Preview.jsx`

Implemented using `markdown-it` with options `{ html: false, linkify: true, typographer: true }`. The `markdown-it` instance is a module-level singleton (stateless, safe to share across renders). The `html` output is memoised via `useMemo` keyed on the `value` prop to avoid redundant rendering work on unrelated parent re-renders.

Key design decisions:
- `html: false` — raw HTML tags in the Markdown source are escaped, not executed. This prevents XSS from untrusted note content. The comment in the component explicitly documents this constraint with the instruction never to set `html: true`.
- `dangerouslySetInnerHTML` — used for the rendered output. Safe because `html: false` strips all HTML tags before the string is injected.
- `data-testid="preview-panel"` — applied to the outer container for Verifier integration tests.
- Tailwind classes: `h-full p-4 font-sans text-sm text-text-primary overflow-y-auto bg-bg-primary` — matches ADR-008 (light background, system font stack, 16px padding).

### `frontend/src/components/editor/Editor.jsx`

Implemented using `@uiw/react-codemirror` (the official React wrapper for CodeMirror 6). Extensions configured: `markdown()` (from `@codemirror/lang-markdown`) for Markdown syntax highlighting; `oneDark` theme (from `@codemirror/theme-one-dark`) for the dark code-editor appearance matching the `bg-editor: #1E1E1E` token.

Key design decisions:
- Controlled component: `value` and `onChange` props are passed directly to the CM6 instance. `WorkspacePage` owns the canonical `editorBody` state.
- `onChange` is wired directly (no debounce in the Editor component). The parent's `setEditorBody` call on every keystroke is what drives the live Preview update. This satisfies FF-D02 (< 100ms preview latency) — there is no artificial delay in the editor-to-preview path.
- `readOnly` prop (default `false`) is passed through to CM6 for use by VersionHistory (TASK-013).
- `data-testid="codemirror-mock"` is passed via `data-testid` prop to the CM6 instance — the mock intercepts this in tests.
- `data-testid="editor-panel"` on the outer container for Verifier integration tests.
- Inline style for font family and size (not Tailwind) because these must be applied inside the CM6 shadow DOM context.

### `frontend/src/pages/WorkspacePage.jsx`

Three changes:

1. **Imports:** Added `Editor` and `Preview` to the import list.
2. **`editorBody` state:** A new `string` state (initialised to `''`) is the single source of truth for both the Editor value and Preview value. It is initialised from `activeNote.body` in the note-loading `useEffect` when a note is selected, and updated on every keystroke via `handleEditorChange`.
3. **`handleEditorChange` callback:** A `useCallback`-memoised handler that calls `setEditorBody(newValue)`. No debounce — this is the live-preview path (FF-D02). The 2-second auto-save debounce is a separate concern (TASK-012) that will be layered on top.
4. **Render:** The editor and preview placeholder divs are replaced by `<Editor value={editorBody} onChange={handleEditorChange} />` and `<Preview value={editorBody} />`.
5. **Note-loading `useEffect`:** When `activeNoteId` becomes null, `editorBody` is reset to `''`. When a note loads, `setEditorBody(data.note.body || '')` is called alongside `setActiveNote`.
6. **Docstring:** Updated to reflect the new `editorBody` state and its role as the single source of truth for both panels.

---

## Test counts

| Suite | Before (this task) | After (this task) |
|---|---|---|
| Backend unit tests (Jest) | 86 passed | 86 passed (no change) |
| Frontend unit tests (Vitest) | 166 passed | 196 passed |

---

## New test files

- `frontend/src/__tests__/Preview.test.jsx` — 16 tests: ATX heading, H2, bold, italic, link, unordered list, ordered list, fenced code block, inline code, paragraph, XSS safety (script tag escaped, HTML tag escaped), empty string, reactivity (value prop change), container presence, data-testid.
- `frontend/src/__tests__/Editor.test.jsx` — 8 tests: container element, data-testid="editor-panel", value passed to CM6, empty string value, onChange called on change, onChange receives string (not event), readOnly defaults false, readOnly=true passed through.
- `frontend/src/__tests__/WorkspaceEditor.test.jsx` — 6 tests: editor panel rendered, preview panel rendered, CodeMirror instance rendered, note body flows to CM6 on selection, note body appears as HTML in preview panel, empty state editor value is `''`.

### Modified test files

- `frontend/src/__tests__/WorkspacePage.test.jsx` — Added `@uiw/react-codemirror` mock. Updated `'renders placeholder text in editor and preview panels'` (stale: placeholder text no longer exists) to `'renders the Editor and Preview components in the editor and preview panels'` — now checks for `data-testid="editor-panel"` and `data-testid="preview-panel"` and asserts the placeholder strings are absent.
- `frontend/src/__tests__/WorkspaceNoteCatalog.test.jsx` — Added `@uiw/react-codemirror` mock. Updated `'displays the body of the selected note in the editor area after clicking'` (stale: was checking for `screen.getByText('Body of selected note')` in a plain `<p>` tag) to check `container.querySelector('[data-testid="codemirror-mock"]').defaultValue`.

---

## Acceptance criteria coverage

| AC | Status | Notes |
|---|---|---|
| AC-1: Two panels side by side — left is CM6 editor with Markdown highlighting, right is markdown-it preview | SATISFIED | Editor and Preview components rendered in WorkspaceLayout's editor and preview slots |
| AC-2: Every edit reflected in preview without user action (live rendering) | SATISFIED | handleEditorChange updates editorBody → Preview re-renders with new value; no debounce on this path |
| AC-3: Preview updates < 100ms (FF-D02) | SATISFIED | Direct CM6 onChange → setState → re-render; no artificial delay; useMemo in Preview prevents redundant md.render() calls |
| AC-4: Syntax highlighting distinguishes headings, bold, italic, links, lists, code | SATISFIED | `markdown()` extension from `@codemirror/lang-markdown` provides this; `oneDark` theme applies the colour differentiation |
| AC-5: CommonMark compliance | SATISFIED | `markdown-it` passes the CommonMark spec test suite; 9 CommonMark behaviour tests in Preview.test.jsx confirm headings, emphasis, links, lists, code blocks, inline code |
| AC-6: Editor uses dark background (`bg-editor: #1E1E1E`) with monospace font | SATISFIED | `oneDark` theme provides the dark background; monospace font stack applied via inline style to the CM6 container |
| AC-7: Preview uses light background with system font stack | SATISFIED | `bg-bg-primary` (#FFFFFF) background, `font-sans` (system font stack) in Tailwind classes |
| AC-8: Panel dividers are 1px solid border lines (no shadows, no gradients) | SATISFIED | The panel boundaries are provided by `WorkspaceLayout` (existing from TASK-016): `border-r border-border` CSS — 1px solid `#DEE2E6`; no changes needed to the layout |

---

## Deviations from task description

None. All acceptance criteria are implemented as specified.

---

## Known limitations

1. **No auto-save wiring.** `editorBody` changes do not yet trigger auto-save. The `useAutoSave` hook (TASK-012) will be wired to `editorBody` and `activeNoteId` in that task.

2. **Title not editable from the editor.** The Editor component receives and displays only `body`. The note title is not yet editable in the workspace UI — that is scoped to TASK-009 (edit note API + editor title wiring).

3. **No empty-state visual in editor panel.** When no note is selected, the Editor renders with `value=""` — the CM6 editor is visible but empty. A future task may add a placeholder overlay. This is not an AC requirement for TASK-007.

4. **CodeMirror not testable in jsdom.** CM6 requires browser APIs (ResizeObserver, contenteditable, DOM selection APIs) not present in jsdom. Tests mock `@uiw/react-codemirror` with a `<textarea>` that mirrors the value/onChange/readOnly contract. The actual CM6 behaviour (syntax highlighting, key bindings, cursor) is verified by the Verifier's integration tests in the real browser.

5. **Error states not surfaced.** Consistent with prior iterations — network errors on note load leave `editorBody` as `''` and `activeNote` as null. TASK-009 will add error state handling.

---

## Files changed

**Modified files:**
- `frontend/src/components/editor/Editor.jsx` — implemented (was a stub returning null)
- `frontend/src/components/editor/Preview.jsx` — implemented (was a stub returning null)
- `frontend/src/pages/WorkspacePage.jsx` — editorBody state, handleEditorChange, Editor+Preview wired in render, note-load useEffect updated
- `frontend/src/__tests__/WorkspacePage.test.jsx` — CM6 mock added, stale test updated
- `frontend/src/__tests__/WorkspaceNoteCatalog.test.jsx` — CM6 mock added, stale assertion updated

**New files:**
- `frontend/src/__tests__/Preview.test.jsx` — 16 unit tests for Preview component
- `frontend/src/__tests__/Editor.test.jsx` — 8 unit tests for Editor component
- `frontend/src/__tests__/WorkspaceEditor.test.jsx` — 6 integration tests for WorkspacePage editor+preview wiring
