# Routing Instruction -- Builder
**Task:** TASK-014 | **Iteration:** 1 of 3
**Date:** 2026-03-21 | **From:** Orchestrator | **To:** Builder

---

## Context

TASK-014 implements full-text search across notes (REQ-010, ADR-005). This is a P1 Must Have feature -- one of the core product promises (Carla's keyword search across hundreds of notes). It is the second task in Cycle 2, following TASK-024 (rate limiting, now VERIFIED PASS).

The infrastructure is already in place from Cycle 1:
- The `notes` table has a `search_vector` TSVECTOR column, a GIN index (`idx_notes_search`), and a trigger (`notes_search_vector_trigger`) that maintains the vector on INSERT/UPDATE (migration `20260319000003-create-notes.js`)
- The trigger weights title as `A` and body as `B`
- The search route is mounted at `GET /api/search` in `app.js` (line 93)

The Scaffolder has prepared these stubs:
- `backend/src/routes/search.js` -- route handler stub with full contract (GET /, returns `{ results: [...] }`)
- `backend/src/services/searchService.js` -- service stub with full sanitization algorithm documented
- `frontend/src/api/search.js` -- client API stub
- `frontend/src/components/Search/SearchBar.jsx` -- debounced search input component stub with `forwardRef`

**Important endpoint path note:** The task plan AC-1 references `GET /api/notes/search?q=:query`, but the actual architecture (app.js, scaffold, ADR-005) mounts search at `GET /api/search?q=:query`. Use the architecture's path: `GET /api/search?q=:query`.

## What to Build

### Backend

#### Step 1: Implement `backend/src/services/searchService.js`

Replace the stub with a working `search(userId, rawQuery)` function:

1. **Sanitize the query** (ADR-005 algorithm):
   - Split `rawQuery` on whitespace
   - For each term, remove characters that are not alphanumeric or hyphen (keep `[a-zA-Z0-9-]`)
   - Filter out empty terms after sanitization
   - If no terms remain after sanitization, throw an Error with message `'EMPTY_QUERY'`
   - Join all-but-last terms with ` & ` (AND semantics)
   - Append `:*` to the last term for prefix matching
   - Example: `"postgres index"` becomes `"postgres & index:*"`
   - Single term: `"postgres"` becomes `"postgres:*"`

2. **Execute the FTS query** using `sequelize.query()` with bind parameters:
   ```sql
   SELECT id, title,
          ts_headline('english', body, query,
                      'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30') AS snippet,
          ts_rank(search_vector, query) AS rank
   FROM notes,
        to_tsquery('english', :sanitized_query) AS query
   WHERE user_id = :user_id
     AND search_vector @@ query
   ORDER BY rank DESC;
   ```

3. **Return** the results array with shape `{ id, title, snippet, rank }`. Empty array when no matches (not an error).

**Edge cases to handle:**
- All-special-character input (e.g., `"!!!"`) -> after sanitization, no terms remain -> throw `EMPTY_QUERY`
- Single term -> `"term:*"` (no `&` separator)
- Hyphenated terms (e.g., `"full-text"`) -> keep the hyphen, result: `"full-text:*"`

#### Step 2: Implement `backend/src/routes/search.js`

Replace the stub handler for `GET /`:
- Read `req.query.q` -- if missing, empty, or whitespace-only, return 400 with `{ error: 'EMPTY_QUERY' }`
- Call `searchService.search(req.session.userId, req.query.q)`
- On success: return 200 with `{ results: [...] }`
- Catch `EMPTY_QUERY` error from the service and return 400 with `{ error: 'EMPTY_QUERY' }`
- Other errors: pass to `next(err)`

The route already has `authenticate` and `rlsContext` middleware applied. Do not change that.

### Frontend

#### Step 3: Implement `frontend/src/api/search.js`

Replace the stub:
- Call `GET /api/search?q=${encodeURIComponent(query)}`
- Return the parsed JSON response
- Use the existing `client.js` module's `get` function (already imported as `_get`)

#### Step 4: Implement `frontend/src/components/Search/SearchBar.jsx`

Replace the stub with a working component:
- Local state: `query` (string), `isLoading` (boolean)
- On input change: update `query` state, debounce the search call by 300ms
- On debounce fire or Enter key: call `search(query)` from `api/search.js`
- If query is empty after trim: call `onResults([])` immediately, skip API call
- On success: call `onResults(data.results)`
- On error: call `onError(err)` if provided
- Forward `ref` to the `<input>` element
- Show a loading indicator while the search request is in flight
- Style consistently with the existing sidebar using ADR-008 design tokens (dark theme, `bg-bg-sidebar` area)

#### Step 5: Wire SearchBar into WorkspacePage

- Import and render `SearchBar` in the sidebar area of `frontend/src/pages/WorkspacePage.jsx`
- When results are returned, display them below the search bar (or in the note list area)
- Each result should show: note title and a snippet (rendered as HTML with `dangerouslySetInnerHTML` since the snippet contains `<mark>` tags from `ts_headline`)
- Clicking a result should open that note in the editor (set `activeNoteId` to the result's `id`)
- When the search query is cleared, restore the normal note list view
- Empty results should show a "No notes found" message

### Tests

#### Step 6: Backend tests

**Unit tests** (`backend/tests/unit/searchService.test.js`):
- Sanitization: multi-term input produces correct tsquery format
- Sanitization: single term produces `"term:*"`
- Sanitization: special characters are stripped
- Sanitization: empty/whitespace-only input throws `EMPTY_QUERY`
- Sanitization: all-special-char input throws `EMPTY_QUERY`
- Sanitization: hyphenated terms are preserved

**Integration/acceptance tests** (`backend/tests/acceptance/TASK-014-search.test.js`):
- AC-1: Search input calls `GET /api/search?q=:query` and returns results
- AC-2: Query sanitization produces tsquery-safe format
- AC-3: Query uses GIN index (verify with EXPLAIN ANALYZE that index scan is used, not seq scan)
- AC-4: Note with "PostgreSQL" in title is returned when searching for "PostgreSQL"
- AC-5: Note with "PostgreSQL" only in body is returned when searching for "PostgreSQL"
- AC-6: Title match ranks higher than body-only match
- AC-7: Results include title and snippet with `<mark>` highlighted terms
- AC-8: Search results scoped to authenticated user only (create notes for two users, search returns only the querying user's notes)
- AC-9: Non-existent term returns empty results array (not 404)
- AC-10: Performance -- seed 200 notes, search completes in < 200ms (measure with `performance.now()` or `Date.now()`)

**Important:** For the performance test (AC-10), create 200 notes for a single user, then run a search query and assert it completes within 200ms. The GIN index should make this trivially fast.

#### Step 7: Frontend tests

**Component tests** (`frontend/src/__tests__/SearchBar.test.jsx`):
- Renders an input with the correct placeholder
- Calls `onResults` with results after debounce
- Calls `onResults([])` when input is cleared
- Shows loading state while search is in flight
- Forwards ref to the input element
- Calls `onError` on API failure (when provided)

## Acceptance Criteria (from Task Plan)

1. Search input in the UI accepts a text query and calls `GET /api/search?q=:query` (note: task plan says `/api/notes/search` but the architecture uses `/api/search`)
2. `searchService` converts user input to a tsquery-safe format: split on whitespace, remove special chars, join with `&`, append `:*` to last term for prefix matching
3. Query uses the `search_vector` column with GIN index; no sequential scan
4. A note with "PostgreSQL" in the title is returned when searching for "PostgreSQL" (title field searched)
5. A note with "PostgreSQL" only in the body is returned when searching for "PostgreSQL" (body field searched)
6. Title match ranks higher than body-only match (weight A vs weight B)
7. Results include note title and a text snippet with highlighted matching terms (via `ts_headline`)
8. Search results scoped to authenticated user only (per-user isolation enforced)
9. Non-existent term returns empty results with a clear message
10. Search across 200 notes completes in < 200ms

## Files to Touch

| File | Action |
|---|---|
| `backend/src/services/searchService.js` | Implement (replace stub) |
| `backend/src/routes/search.js` | Implement (replace stub handler) |
| `frontend/src/api/search.js` | Implement (replace stub) |
| `frontend/src/components/Search/SearchBar.jsx` | Implement (replace stub) |
| `frontend/src/pages/WorkspacePage.jsx` | Modify (add SearchBar and results display) |
| `backend/tests/unit/searchService.test.js` | Create |
| `backend/tests/acceptance/TASK-014-search.test.js` | Create |
| `frontend/src/__tests__/SearchBar.test.jsx` | Create |

## Constraints

- Do NOT modify the migration or trigger -- the `search_vector` column and GIN index already exist
- Do NOT change the route mount point -- it is already `GET /api/search` in `app.js`
- Use `plainto_tsquery` as a fallback if `to_tsquery` throws on malformed input, OR ensure sanitization is robust enough that `to_tsquery` never receives invalid input
- Use bind parameters (`:sanitized_query`, `:user_id`) in the SQL query -- never interpolate user input directly
- Do NOT use `req.query.q` directly in the SQL -- always sanitize through the service
- Style the SearchBar and results using existing ADR-008 design tokens (Tailwind classes from the existing sidebar palette)
- The `<mark>` tags in snippets come from PostgreSQL `ts_headline` -- render them safely with `dangerouslySetInnerHTML` (this is safe because the content is server-generated, not user-controlled HTML)

## Commit Convention

Commit message: `TASK-014: Full-text search across notes -- [summary of what was done]`

Push to `main` branch after committing.

## Handoff

After completing implementation and tests, provide:
1. What was built (files changed/created)
2. Test results (all tests passing, count)
3. Any deviations from this routing instruction
4. Any observations or concerns
