# Routing Instruction
**To:** Scaffolder
**Phase:** Cycle 3 Execution -- pre-Builder scaffolding
**Task:** Create file stubs for Cycle 3 Builder tasks (TASK-027 through TASK-030). 4 Builder tasks >= 3 threshold per Manifest.
**Load these artifacts:**
- `process/planner/task-plan-v3.md` (Cycle 3 task plan)
- `process/architect/adr/ADR-010-tagging-schema.md` (tagging schema)
- `process/architect/adr/ADR-011-bulk-export.md` (bulk export endpoint)
- `process/architect/adr/ADR-008-design-aesthetic.md` (design tokens for reading mode)
**Produce:** File stubs and scaffold manifest at `process/scaffolder/scaffold-manifest-cycle3.md`
**Verifier mode:** N/A (Scaffolder output, not Verifier invocation)
**Return to:** Orchestrator when complete

## Stubs Needed

### TASK-027: Tagging backend
- `backend/src/models/Tag.js` -- Sequelize model stub
- `backend/src/services/tagService.js` -- service stub with function signatures
- `backend/src/routes/tags.js` -- Express router stub
- Migration for tags table
- Migration for note_tags junction table
- Update `backend/src/models/index.js` to include Tag model and associations

### TASK-028: Tagging frontend
- `frontend/src/components/Tags/TagBadge.jsx` -- tag display component stub
- `frontend/src/components/Tags/TagInput.jsx` -- tag input with autocomplete stub
- `frontend/src/components/Tags/TagFilter.jsx` -- sidebar tag filter stub
- `frontend/src/api/tags.js` -- API client stub

### TASK-029: Bulk export
- `backend/src/services/exportService.js` -- service stub
- Add `archiver` to backend/package.json dependencies

### TASK-030: Reading mode
- `frontend/src/components/ReadingMode/ReadingMode.jsx` -- reading mode view stub
