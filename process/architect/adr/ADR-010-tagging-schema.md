# ADR-010: Global Tagging System Schema and Integration
**Date:** 2026-03-21 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

REQ-021 introduces a global tagging system for notes. Tags are user-defined text labels that provide cross-cutting organization independent of folders (REQ-009). A note can have zero or more tags. Tags are per-user (no shared namespace). The catalog sidebar (REQ-008) must support filtering by tag. Tags must appear in search result metadata (REQ-010). Tag names are case-insensitive, limited to 50 characters, and may contain Unicode letters, digits, and hyphens (no spaces, per Nexus clarification at Requirements Gate v4).

The existing schema (ADR-003) has five tables: users, folders, notes, note_versions, password_reset_tokens. Tags introduce a many-to-many relationship between notes and labels.

**Driver:** Data model extension, Organizational features
**Door type:** Two-way -- adding tables and a junction is a standard migration; removing or restructuring tags is a migration-level effort but does not affect existing tables

## Trade-off Analysis

### Schema Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Separate tags + note_tags tables (normalized) | Referential integrity via FK, efficient querying, clean JOIN patterns, consistent with ADR-003 approach | Two new tables, JOINs for tag-based queries | Standard pattern, low risk | LOW -- drop tables |
| JSONB array on notes table (denormalized) | No new tables, simple read path | No referential integrity, harder to query across notes by tag, no FK constraints, hard to enforce uniqueness and case-insensitivity | Tag orphaning, inconsistent state | MEDIUM -- extract to tables |
| Separate tags table only (tags embed note references) | Fewer tables | Violates normalization, hard to query notes by tag efficiently | Poor query patterns | MEDIUM -- restructure |

**Recommendation:** Separate tags + note_tags tables (normalized)
**Because:** Consistent with ADR-003 (normalized relational schema). Referential integrity enforced by database. The many-to-many relationship maps cleanly to a junction table. Querying notes by tag is efficient with proper indexes.

### Search Integration

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Add tag names to tsvector (weight C) | Tags searchable via existing full-text search infrastructure | Trigger must be updated to include tags, reindex needed | Over-indexing tag names (low risk -- tags are short strings) | LOW -- update trigger |
| Tags in search result metadata only (not indexed) | Simpler, no trigger change | Users cannot search by tag name via the search box | May frustrate users who expect to find notes by tag via search | LOW -- add to trigger later |

**Recommendation:** Add tag names to tsvector (weight C)
**Because:** Users will naturally try to search for tag names. Including tags in the search vector with weight C (lower than title A and body B) means tag matches appear in results but rank below title and body matches. This is the intuitive behavior. The trigger update is minimal.

## Decision

### Schema

```sql
-- Tags (user-owned)
CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user_id ON tags(user_id);

-- Note-Tag junction (many-to-many)
CREATE TABLE note_tags (
    note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

### Key Schema Decisions

1. **ON DELETE CASCADE on user_id (tags):** When a user deletes their account, all their tags are deleted atomically. Consistent with ADR-003 cascade strategy.

2. **ON DELETE CASCADE on note_id (note_tags):** When a note is deleted, its tag associations are removed. The tag itself persists (it may be used by other notes).

3. **ON DELETE CASCADE on tag_id (note_tags):** When a tag is deleted entirely (REQ-021), all its note associations are removed atomically.

4. **UNIQUE(user_id, name):** Enforces per-user tag uniqueness at the database level. Combined with application-level lowercase normalization, this ensures case-insensitive uniqueness.

5. **Composite primary key on note_tags:** No surrogate key needed. The (note_id, tag_id) pair is naturally unique.

6. **Tag name validation:** Application-level validation enforces: max 50 characters, Unicode letters + digits + hyphens only, no spaces. Stored lowercase. The database enforces the length constraint via VARCHAR(50); the character set constraint is enforced at the application layer.

### Search Vector Update

The existing trigger (ADR-005) is extended to include tag names:

```sql
CREATE OR REPLACE FUNCTION notes_search_vector_update() RETURNS trigger AS $$
DECLARE
    tag_text TEXT;
BEGIN
    SELECT string_agg(t.name, ' ') INTO tag_text
    FROM note_tags nt
    JOIN tags t ON t.id = nt.tag_id
    WHERE nt.note_id = NEW.id;

    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(tag_text, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Note:** The search vector is updated when the note's title or body changes (existing trigger). When tags are added or removed, the note's `updated_at` should be touched to fire the trigger, or a separate trigger on `note_tags` should call a function that updates the note's search_vector. The Builder should implement the approach that best fits the Sequelize hook model.

### API Endpoints

```
GET    /api/tags                     -- list user's tags
POST   /api/tags                     -- create a tag
DELETE /api/tags/:id                 -- delete a tag (CASCADE removes all associations)
POST   /api/notes/:id/tags           -- add a tag to a note (body: { tagId } or { name } for inline creation)
DELETE /api/notes/:id/tags/:tagId    -- remove a tag from a note
GET    /api/notes?tags=id1,id2       -- filter notes by tag(s), OR logic
```

### Catalog Sidebar Integration

- Note entries in the sidebar include tag badges (small colored labels)
- A tag filter section in the sidebar (above or below the note list) displays all user tags as clickable badges
- Clicking a tag badge toggles its filter state; active filters narrow the displayed notes (OR logic)
- Clearing all tag filters restores the full note list

### Per-User Isolation

Tags inherit the per-user isolation model from ADR-006:
- The `user_id` foreign key on `tags` scopes all tag queries to the authenticated user
- The ownership guard middleware validates tag ownership before any operation
- RLS policies (if applied) further enforce isolation at the database level

## Fitness Functions

**Dev:**
- Test: creating a tag persists it in the database with the correct user_id
- Test: adding a tag to a note creates a note_tags row
- Test: deleting a tag CASCADE removes all note_tags associations
- Test: deleting a note CASCADE removes all note_tags associations for that note
- Test: deleting a user CASCADE removes all tags and note_tags
- Test: UNIQUE(user_id, name) prevents duplicate tags per user
- Test: tag names are stored lowercase (case-insensitive)
- Test: tag names exceeding 50 characters are rejected
- Test: tag names with spaces are rejected
- Test: tag names with Unicode letters (accented, CJK) are accepted
- Test: filtering notes by tag returns only matching notes (OR logic for multiple tags)
- Test: tags are included in search results metadata
- Test: searching for a tag name returns notes with that tag (weight C in tsvector)
- Test: User A cannot see or use User B's tags

**Prod:**
- Tag query p95 latency: Warning > 200ms | Critical > 1000ms
- Monitor tag count per user: Warning > 500 tags (may indicate abuse or UI performance issues)

## Consequences

- Two new tables add minimal storage overhead (tags are short strings, junction table is two UUIDs per row)
- The search vector trigger becomes slightly more complex (JOIN to note_tags and tags) -- acceptable overhead
- Tag filtering adds a JOIN to the notes list query -- acceptable with the GIN index on note_tags.tag_id
- The catalog sidebar UI must accommodate tag badges and a filter mechanism -- this is additive, not a breaking change to existing UI
- Tag names stored lowercase means the display is always lowercase -- if mixed-case display is desired later, store the original case and use a separate normalized column for uniqueness
