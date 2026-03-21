# Verification Report — TASK-028
**Task:** TASK-028 — Tagging system frontend — UI integration
**Requirement(s):** REQ-021
**ADR(s):** ADR-010, ADR-008
**Date:** 2026-03-21
**Iteration:** 1
**Verdict:** FAIL

---

## Summary

TASK-028 delivers the tagging frontend: `TagChip`, `TagInput`, `TagFilter` components, an updated `Sidebar`, a new `api/tags.js` client module, and integration into `WorkspacePage`. The Verifier wrote 29 acceptance tests covering AC-1 through AC-9 (AC-7 and AC-10 explicitly not covered per Builder deviation). All 29 acceptance tests pass locally.

CI run **23391141569** failed on the **Lint** job due to a `no-undef` ESLint error in a Builder unit test file (`frontend/src/__tests__/tagsApi.test.js`, line 65). All other jobs passed: Unit Tests (543 frontend + 265 backend), Migration Test (704 passed, 7 skipped), and Integration Tests (38 passed). The Docker build was skipped because of the lint failure.

**Builder-declared deviations:**
- **AC-7 (autocomplete dropdown):** Not implemented. Accepted as a known deviation by the Orchestrator in the routing instruction. No test written.
- **AC-10 (tags in search results):** Declared out of scope for this task. The requirement (REQ-021, GWT scenario 9) is not satisfied by the current implementation. No test written per routing instruction.

The lint failure is a blocking defect in the Builder's unit test file. The acceptance criteria themselves (as tested by the Verifier's 29 tests) all PASS when run locally. TASK-028 cannot be marked PASS until CI is green.

---

## CI Run Details

**Run ID:** 23391141569
**Commit:** (TASK-028: Tagging system frontend push)
**Branch:** main

| Job | Result | Detail |
|---|---|---|
| Unit Tests | PASS | 265 backend + 543 frontend tests pass (45s) |
| Migration Test | PASS | 704 passed, 7 skipped, 0 failed (2m45s) |
| Integration Tests | PASS | 38 passed, 7 skipped (29s) |
| Lint | FAIL | Frontend ESLint: `no-undef` on `global` at `tagsApi.test.js:65` |
| Build Docker Image | Skipped | Blocked by Lint failure |

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| AC-1 | Tag badges appear on note entries in the catalog sidebar (small colored labels below the note title) | PASS | 3 tests (1 positive, 1 negative, 1 verifier-added). Sidebar NoteItem renders TagChip components from `note.tags`. Chips have `data-testid="tag-chip"`. Read-only (no × in catalog). All pass locally. |
| AC-2 | Tag filter section visible in the sidebar (above the note list) showing all user tags as clickable badges | PASS | 3 tests (1 positive, 1 negative, 1 coverage). TagFilter component renders when `tags.length > 0`; hidden when empty. All user tags appear as buttons. All pass locally. |
| AC-3 | Clicking a tag badge toggles filter state; active filters are visually distinguished (highlighted background) | PASS | 4 tests (2 positive, 1 negative, 1 toggle-off). Selected tags carry `aria-pressed="true"` and `bg-accent` CSS class. Unselected tags do not. Toggling off confirmed. All pass locally. |
| AC-4 | When tag filters are active, only notes matching ANY selected tag are displayed (OR logic) | PASS | 3 tests (1 positive, 1 negative, 1 verifier-added multi-tag). WorkspacePage re-fetches `getNotes(selectedTagIds)` on filter change. Multi-tag call confirmed with both IDs. All pass locally. |
| AC-5 | "Clear filters" removes all active tag filters and restores the full note list | PASS | 4 tests (2 positive, 1 negative, 1 re-fetch). "Clear filters" button appears when any filter is active; clicking it clears `selectedTagIds` and triggers `getNotes([])`. All pass locally. |
| AC-6 | "Add tag" input allows typing a tag name + Enter to add it; inline creation if tag does not exist | PASS | 4 tests (1 presence, 1 negative, 1 API call, 1 input clear). TagInput renders below toolbar when note is active. Enter calls `addTagToNote(noteId, { name })`. Input cleared after success. All pass locally. |
| AC-7 | Tag input provides autocomplete from existing user tags | NOT IMPLEMENTED | Builder declared not implemented. No test written per routing instruction. This criterion is UNVERIFIED. |
| AC-8 | A tag on a note can be removed by clicking × on the tag badge in the editor/note detail view | PASS | 3 tests (1 presence, 1 API call, 1 negative). TagChip in TagInput renders × button (onRemove prop). Clicking calls `removeTagFromNote(noteId, tagId)`. All pass locally. |
| AC-9 | Tag validation: names > 50 chars, names with spaces, or invalid characters show a clear error message | PASS | 5 tests (2 positive, 1 negative, 2 verifier-added boundary). Space validation, >50 char validation, empty input validation all show `tag-input-error`. Exactly 50 chars is valid. All pass locally. |
| AC-10 | Tags in search results are displayed alongside the result entry | OUT OF SCOPE | Builder declared out of scope for this task. Search results do not currently show tag metadata. This criterion is UNVERIFIED. |

---

## Failures

### FAIL-1 (BLOCKING): ESLint `no-undef` error on `global` in Builder unit test

**Layer:** Lint
**Affected file:** `frontend/src/__tests__/tagsApi.test.js`, line 65
**CI Job:** Lint — Frontend
**Exact error:**
```
/home/runner/work/BrainDump/BrainDump/frontend/src/__tests__/tagsApi.test.js
  65:14  error  'global' is not defined  no-undef
```

**Context:**
```javascript
// tagsApi.test.js line 64-68
await getTags();

expect(global.fetch).toHaveBeenCalledWith(   // ← line 65: 'global' is not defined
  '/api/tags',
  expect.objectContaining({ credentials: 'include' })
);
```

**Root cause:** The test accesses `global.fetch` using the Node.js `global` identifier, which the frontend ESLint configuration (`eslint-plugin-react` with browser environment) does not recognise as defined. The Vitest `globals: true` config makes the test runner inject global test APIs, but `global` itself (the Node.js global object) is not in the browser ESLint environment globals list.

**Required fix:** Replace `global.fetch` with `vi.stubGlobal('fetch', ...)` approach already used in the other assertions in the same describe block. The fix is one of:
1. Replace `expect(global.fetch).toHaveBeenCalledWith(...)` with `expect(fetch).toHaveBeenCalledWith(...)` — since vitest's jsdom environment makes `fetch` available as a global without the `global.` prefix; or
2. Add `/* eslint-disable no-undef */` for that specific line; or
3. Replace `global.fetch` with the already-stubbed mock reference: move the `mockFetch` variable from the previous `vi.stubGlobal` call into scope and assert on it directly.

Option 1 is the cleanest: change `global.fetch` to `fetch` on line 65. The `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(...))` call on the lines above already stubs the global fetch — asserting on `fetch` directly will work.

---

## Observations

**OBS-1: AC-7 (autocomplete) creates a gap in the tagging UX**
AC-7 is not implemented. Users will see an "Add tag…" input but no suggestions from existing tags. This reduces discoverability of existing tags. The criterion is explicitly in the requirements (REQ-021 GWT 10: "When [user selects multiple tag filters], then notes tagged with either ... are displayed"). The autocomplete gap is not a blocker for this iteration but should be tracked for a follow-up task.

**OBS-2: AC-10 (tags in search results) remains unverified**
The REQ-021 GWT scenario "Given an authenticated user viewing search results, when a matching note has tags, then the tags are displayed alongside the search result entry" is not implemented. The search results list in WorkspacePage does not render TagChip components for result entries. If this is to be satisfied within REQ-021, a follow-up task is needed.

**OBS-3: Pre-existing lint warnings (not introduced by this task)**
The lint job produces two pre-existing warnings:
- `'sequelize' is assigned a value but never used` at `backend/src/services/tagService.js:11` (noted in TASK-027 verification OBS-2)
- `'isProduction' is assigned a value but never used` at `backend/src/config/database.js:30` (noted in TASK-027 verification OBS-3)
These are not new and are not blockers for TASK-028.

**OBS-4: TagInput removes tags silently on API failure**
When `removeTagFromNote` fails, the component catches the error and does not update state (correct) but also provides no user feedback. This is a documented design decision in the component (comment: "Removal failure is non-fatal; parent state is not updated"). For a production scenario, a brief error toast would improve UX.

---

## Regression Status

All 543 pre-existing frontend tests pass with the addition of 29 new acceptance tests (572 total). All 704 backend acceptance/migration tests pass. No regressions introduced.

---

## Test Artifacts

**Acceptance test file:** `frontend/src/__tests__/TASK-028-tagging-frontend-verifier.test.jsx`
- 29 tests covering AC-1 through AC-9 (AC-7 and AC-10 excluded per Builder deviations)
- 8 negative cases: `[NEGATIVE]` tagged
- 5 verifier-added boundary and coverage cases: `[VERIFIER-ADDED]` tagged
- All tests run in the frontend Vitest environment (jsdom); no network or database required
- All 29 tests pass locally

**Location stub:** `tests/acceptance/TASK-028-tagging-frontend.test.jsx`
(Frontend JSX tests must live in `frontend/src/__tests__/` to be picked up by the Vitest runner)

---

## Required Fixes Before Re-verification

1. **FAIL-1 (BLOCKING):** In `frontend/src/__tests__/tagsApi.test.js` at line 65, replace `global.fetch` with `fetch`. Specifically, change:
   ```javascript
   expect(global.fetch).toHaveBeenCalledWith(
   ```
   to:
   ```javascript
   expect(fetch).toHaveBeenCalledWith(
   ```
   This removes the `no-undef` ESLint error and allows the lint job to pass. The assertion itself remains correct because `vi.stubGlobal('fetch', vi.fn().mockResolvedValue(...))` on the lines above makes `fetch` available in the jsdom environment.

No other changes are required. The acceptance criteria (AC-1 through AC-6, AC-8, AC-9) are all implemented correctly and verified to pass.
