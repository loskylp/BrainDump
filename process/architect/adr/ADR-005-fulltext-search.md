# ADR-005: Full-text Search via PostgreSQL FTS
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

REQ-010 requires full-text search across both note title and body fields, backed by PostgreSQL full-text search capabilities (not application-level string matching). Results must be relevance-ranked. Search must remain fast as note collections grow to hundreds of notes per user. The persona (Carla the Writer) searches by keyword across hundreds of bibliographic source notes -- search speed and relevance are high-priority UX concerns.

**Driver:** Performance, Maintainability
**Door type:** Two-way -- the FTS implementation is localized to one table, one index, and one query builder; changing the approach requires updating these three components

## Trade-off Analysis

### Indexing Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Maintained tsvector column with trigger | Fast queries (pre-computed vector), GIN index for sub-linear search | Write overhead (trigger on every INSERT/UPDATE), extra column storage | Trigger adds ~1ms per write -- negligible for a note-taking app | LOW -- change trigger function and reindex |
| Computed tsvector at query time (to_tsvector in WHERE clause) | No storage overhead, no trigger | Slow queries (must compute tsvector for every row on every search), cannot use GIN index effectively | Search becomes unusably slow at hundreds of notes | MEDIUM -- add column and backfill |
| External search engine (Elasticsearch) | Advanced features (fuzzy matching, facets, more like this) | New infrastructure dependency, data sync complexity, operational overhead | Over-engineered for a single-user note collection with hundreds of notes | HIGH -- remove infrastructure, rewrite search layer |

**Recommendation:** Maintained tsvector column with trigger
**Because:** PostgreSQL FTS with a pre-computed tsvector and GIN index provides sub-millisecond search across hundreds of notes per user. The write overhead of the trigger is negligible for a note-taking app where reads vastly outnumber writes. This stays within the PostgreSQL constraint and adds no external dependencies.

### Weighting Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Weighted vectors (title=A, body=B) | Title matches rank higher than body matches -- intuitive relevance | Slightly more complex trigger function | Weights may need tuning | LOW -- update trigger, reindex |
| Equal weight (concatenate title and body) | Simpler trigger | A note titled "PostgreSQL" ranks the same as one that mentions it once in a long body | Poor relevance ranking | LOW -- add weights, reindex |

**Recommendation:** Weighted vectors (title=A, body=B)
**Because:** When Carla searches for "PostgreSQL," a note titled "PostgreSQL Indexing" should rank higher than a note that mentions PostgreSQL once in a long body. Weight A (title) is the highest PostgreSQL FTS weight; weight B (body) is the second highest.

## Decision

### Implementation

**Trigger function:**
```sql
CREATE OR REPLACE FUNCTION notes_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_search_vector_trigger
    BEFORE INSERT OR UPDATE OF title, body ON notes
    FOR EACH ROW
    EXECUTE FUNCTION notes_search_vector_update();
```

**GIN index:** (defined in ADR-003 schema)
```sql
CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);
```

**Query pattern:**
```sql
SELECT id, title,
       ts_headline('english', body, query, 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30') AS snippet,
       ts_rank(search_vector, query) AS rank
FROM notes,
     to_tsquery('english', :sanitized_query) AS query
WHERE user_id = :user_id
  AND search_vector @@ query
ORDER BY rank DESC;
```

**Query sanitization:** User input is converted to a tsquery-safe format:
1. Split on whitespace
2. Remove special characters
3. Join with `&` (AND semantics -- all terms must match)
4. Append `:*` to the last term for prefix matching (supports partial word search while typing)

Example: user types `postgres index` -> tsquery: `'postgres' & 'index:*'`

### Search Results Display

Search results include:
- Note title
- A text snippet from the body with matching terms highlighted (via `ts_headline`)
- Relevance rank (used for ordering, not displayed to the user)

The UI location of search results is a Builder decision (per Auditor observation 3). The architecture supports any display approach: sidebar overlay, inline in the catalog, or a dedicated results panel.

### Per-user Isolation in Search

The `WHERE user_id = :user_id` clause ensures search results are scoped to the authenticated user's notes. This is enforced at the query level (application layer) and additionally by RLS policies (see ADR-006). A user can never receive search results containing another user's notes.

### Text Configuration

The `english` text search configuration is used for stemming and stop words. This means:
- "running" matches "run" (stemming)
- Common words like "the," "a," "is" are ignored (stop words)
- This is appropriate for English-language technical documentation

If multi-language support is needed in the future, the configuration can be made per-note or per-user. This is a deferred decision.

## Fitness Functions

**Dev:**
- Test: a note with "PostgreSQL" in the title is returned when searching for "PostgreSQL"
- Test: a note with "PostgreSQL" only in the body is returned when searching for "PostgreSQL"
- Test: a title-match ranks higher than a body-only match for the same query
- Test: search results respect per-user isolation (User A's search does not return User B's notes)
- Test: search for a non-existent term returns empty results
- Test: search across 200 notes completes in < 200ms (performance baseline)
- Test: ts_headline returns snippet with highlighted matching terms

**Prod:**
- Search query p95 latency: Warning > 500ms | Critical > 2000ms
- Monitor search queries that return 0 results at a rate > 50% of searches (may indicate poor search UX or user confusion)

## Consequences

- The tsvector trigger fires on every note INSERT and UPDATE (including auto-save) -- this adds minimal overhead but is technically present on every save
- The `english` text configuration means non-English content will be searched with English stemming rules, which may produce unexpected results -- acceptable for v1 where the target audience is English-speaking technical professionals
- Prefix matching (`:*`) enables search-as-you-type but may produce broader results than exact matching -- this is a UX benefit, not a bug
- The GIN index adds storage overhead proportional to the vocabulary size of the note corpus -- negligible for text content
