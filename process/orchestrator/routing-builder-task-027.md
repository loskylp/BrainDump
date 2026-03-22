# Routing Instruction
**To:** Builder
**Phase:** Cycle 3 Execution
**Task:** TASK-027 -- Tagging backend: schema, model, API
**Iteration:** 1 of 3 (max)
**Load these artifacts:**
- `process/planner/task-plan-v3.md` (TASK-027 section -- 12 acceptance criteria)
- `process/architect/adr/ADR-010-tagging-schema.md` (schema design, API endpoints, search vector integration)
- `process/architect/adr/ADR-003-data-persistence.md` (existing schema for reference)
- `process/architect/adr/ADR-005-fulltext-search.md` (search vector trigger to extend)
- `process/analyst/requirements-v4.md` (REQ-021 acceptance scenarios)
- Existing models: `backend/src/models/` (for pattern reference -- Note.js, Folder.js)
- Existing routes: `backend/src/routes/` (for pattern reference)
- Existing services: `backend/src/services/` (for pattern reference)
**Produce:** Implementation of all 12 acceptance criteria. Commit and push to main.
**Verifier mode:** N/A (Builder invocation)
**Return to:** Orchestrator when complete

## Acceptance Criteria (from task plan)

1. Sequelize migration creates `tags` table with columns: id (UUID PK), user_id (FK to users ON DELETE CASCADE), name (VARCHAR 50), created_at; UNIQUE constraint on (user_id, name)
2. Sequelize migration creates `note_tags` junction table with columns: note_id (FK to notes ON DELETE CASCADE), tag_id (FK to tags ON DELETE CASCADE), created_at; composite PK (note_id, tag_id)
3. Tag model with `forUser(userId)` scope (consistent with Note, Folder models)
4. `POST /api/tags` creates a tag; name is normalized to lowercase; rejects names > 50 chars, names with spaces, names with non-allowed characters (only Unicode letters, digits, hyphens allowed)
5. `DELETE /api/tags/:id` deletes a tag and CASCADE removes all note_tags associations; ownership guard enforced
6. `POST /api/notes/:id/tags` adds a tag to a note (accepts `{ tagId }` or `{ name }` for inline creation); ownership guard enforced on both note and tag
7. `DELETE /api/notes/:id/tags/:tagId` removes a tag association from a note; ownership guard enforced
8. `GET /api/tags` returns all tags for the authenticated user
9. `GET /api/notes` and `GET /api/notes?tags=id1,id2` return notes with their tags included; tag filter uses OR logic
10. Search vector trigger updated to include tag names at weight C; search results include tags in response metadata
11. Per-user isolation: User A cannot see, create, or manipulate User B's tags (404 on ownership mismatch)
12. Creating tag "Research" when "research" already exists for the same user returns the existing tag (case-insensitive dedup)

## Architecture Reference

- Schema: See ADR-010 for exact SQL
- API endpoints: `GET /api/tags`, `POST /api/tags`, `DELETE /api/tags/:id`, `POST /api/notes/:id/tags`, `DELETE /api/notes/:id/tags/:tagId`, `GET /api/notes?tags=id1,id2`
- Tag name validation: Unicode letters + digits + hyphens only. No spaces. Max 50 chars. Stored lowercase.
- Search vector: Update trigger to include tag names at weight C (see ADR-010)
- Follow existing patterns: `forUser(userId)` scope, ownership guard middleware, service layer pattern

## Notes

- The Builder should create appropriate unit and acceptance tests for all endpoints
- The search vector trigger modification requires updating the existing migration or creating a new one that replaces the trigger function
- Existing tests must continue to pass (no regressions)
