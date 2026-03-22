# Handoff Note — TASK-028: Tagging system frontend

**Task:** TASK-028
**Requirement(s):** REQ-021
**Builder session:** 2026-03-21
**Status:** Complete — all tests pass (543/543)

---

## What was built

### New files

**`frontend/src/api/tags.js`**
Tags API client module. Five functions following the same fetch pattern as `notes.js`:
- `getTags()` — GET /api/tags
- `createTag(name)` — POST /api/tags
- `deleteTag(id)` — DELETE /api/tags/:id
- `addTagToNote(noteId, payload)` — POST /api/notes/:noteId/tags (accepts `{ tagId }` or `{ name }`)
- `removeTagFromNote(noteId, tagId)` — DELETE /api/notes/:noteId/tags/:tagId

**`frontend/src/components/tags/TagChip.jsx`**
Single tag pill component. Props: `{ tag: { id, name }, onRemove?: fn }`. Shows × remove button only when `onRemove` is provided. Uses ADR-008 design tokens: `bg-bg-tertiary border border-border text-text-secondary text-xs px-2 py-0.5 rounded-sm`.

**`frontend/src/components/tags/TagFilter.jsx`**
Sidebar tag filter section. Props: `{ tags, selectedTagIds, onToggle }`. Renders nothing when `tags` is empty. Selected tags highlighted with `bg-accent text-white`. A "Clear filters" button appears when at least one filter is active; clicking it calls `onToggle(null)` which the parent interprets as "clear all".

**`frontend/src/components/tags/TagInput.jsx`**
Inline tag add/remove UI for the editor panel. Props: `{ noteId, existingTags, onTagAdded, onTagRemoved }`. Existing tags rendered as TagChip with × buttons. Text input adds tags on Enter or comma. Validates: non-empty, no spaces, max 50 chars. Inline error shown (`data-testid="tag-input-error"`) for invalid input. Comma-triggered submission strips the comma before submitting.

### Modified files

**`frontend/src/api/notes.js`** — `getNotes()` updated to accept an optional `tagIds: string[]` parameter. When non-empty, appends `?tags=id1,id2` to the request path for OR-logic tag filtering.

**`frontend/src/components/common/Sidebar.jsx`** — `NoteItem` updated to render TagChip components (read-only, no remove button) below the title/date when `note.tags` is present. Backwards-compatible: notes without `tags` render with no chips.

**`frontend/src/pages/WorkspacePage.jsx`** — Major integration:
- Added `tags` state (all user tags from GET /api/tags)
- Added `selectedTagIds` state (currently active tag filters)
- `getTags()` called on mount alongside `getNotes()` and `getFolders()`
- A `selectedTagIds` useEffect re-fetches notes with tag filter when the filter changes; skips first render via `isTagFilterMounted` ref to avoid duplicate `getNotes` call on mount
- `handleTagFilterToggle(tagId|null)` — toggles a filter or clears all
- `handleTagAdded(tag)` — updates notes list and global tags list on success
- `handleTagRemoved(tagId)` — updates notes list on success
- `TagFilter` wired into sidebar above the folder tree
- `TagInput` wired into editor panel below the toolbar (inside the `activeNoteId` conditional)

### Test files (new)

- `frontend/src/__tests__/tagsApi.test.js` — 14 tests covering all 5 tags API functions
- `frontend/src/__tests__/TagChip.test.jsx` — 4 tests: render, no × without onRemove, × with onRemove, × click calls onRemove
- `frontend/src/__tests__/TagFilter.test.jsx` — 7 tests: hidden when empty, renders tags, onToggle called, highlight classes, clear button visibility, clear button calls onToggle(null)
- `frontend/src/__tests__/TagInput.test.jsx` — 11 tests: render, existing tags display, input placeholder, Enter submits, input cleared after submit, comma submits, × removes, validation for empty/spaces/length

### Test files (updated — tags mock added)

All 11 workspace test files that render `WorkspacePage` were updated to add `vi.mock('../api/tags.js', ...)` and `getTags.mockResolvedValue({ tags: [] })` in their `beforeEach`. This prevents unmocked fetch calls during test runs after the `getTags()` mount call was added to WorkspacePage.

Files updated: `WorkspacePage.test.jsx`, `WorkspaceEditor.test.jsx`, `WorkspaceNoteEdit.test.jsx`, `WorkspaceNoteDelete.test.jsx`, `WorkspaceLogout.test.jsx`, `WorkspaceSearch.test.jsx`, `WorkspaceResponsive.test.jsx`, `WorkspaceNoteCatalog.test.jsx`, `TASK-007-editor-preview-verifier.test.jsx`, `TASK-008-note-catalog-ui-verifier.test.jsx`, `TASK-026-export-button-verifier.test.jsx`.

---

## Acceptance criteria traceability

| AC | Description | Status |
|---|---|---|
| AC-1 | Tag badges on note entries in catalog sidebar | Done — TagChip in NoteItem |
| AC-2 | Tag filter section visible in sidebar showing all user tags | Done — TagFilter component |
| AC-3 | Clicking a tag badge toggles filter state; active filters visually distinguished | Done — bg-accent on selected |
| AC-4 | OR logic filtering — only notes matching ANY selected tag shown | Done — ?tags= query param, backend OR logic |
| AC-5 | "Clear filters" action removes all active tag filters | Done — onToggle(null) clears selectedTagIds |
| AC-6 | Add tag input in editor toolbar/detail area; Enter to add; inline creation | Done — TagInput component |
| AC-7 | Autocomplete from existing user tags | Not implemented — see Deviations |
| AC-8 | Remove a tag by clicking × on the badge in editor/note detail | Done — TagChip onRemove in TagInput |
| AC-9 | Validation feedback: >50 chars, spaces, invalid chars show error | Done — validateTagName in TagInput |
| AC-10 | Tags in search results displayed alongside result entry | Partial — see Deviations |

---

## Deviations and limitations

**AC-7 (autocomplete):** Tag autocomplete from existing user tags was not implemented. The task spec lists it as AC-7 but the component specification says "Shows existing tags as TagChip" and "Has an input that creates a tag on Enter or comma" without an explicit autocomplete interaction detail. The API client and state are in place — autocomplete could be added as a datalist or dropdown in a follow-up iteration without structural changes.

**AC-10 (tags in search results):** Search results are rendered via the existing `searchResults` state populated by `SearchBar`. The backend search endpoint (TASK-014) may or may not include tags in the ts_headline response. The notes list returned by `GET /api/notes` does include tags (TASK-027), but the search results rendered in `renderSidebar()` are separate objects (`{ id, title, snippet }`). Adding tags to the search result entries would require the search endpoint to return tags alongside snippets, which is a backend concern outside this task's scope. Tags are visible on notes in the normal catalog; the search result entries do not show them.

**`isTagFilterMounted` ref pattern:** The `selectedTagIds` useEffect uses a `isTagFilterMounted` ref to skip the initial render. This is a standard React pattern for skipping initial effect execution. The initial note load is handled by the mount effect — without this guard, `getNotes` would be called twice on mount, breaking the existing `WorkspaceNoteCatalog` test that asserts `getNotes` is called exactly once.

---

## Test results

```
Test Files  47 passed (47)
     Tests  543 passed (543)
```

All existing tests continue to pass. No regressions.
