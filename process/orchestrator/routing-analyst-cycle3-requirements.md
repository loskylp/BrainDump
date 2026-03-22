# Routing Instruction
**To:** Analyst
**Phase:** Cycle 3 Ingestion -- new requirements from stakeholder demo
**Task:** Produce REQ-020 (Full export to ZIP), REQ-021 (Global tagging system), and REQ-022 (Reading Mode). These are new features requested by stakeholders during the Cycle 2 demo. They must be formalized as requirements before Cycle 3 planning begins.
**Load these artifacts:**
- `process/analyst/brief-v2.md` (Domain Model, audience context, ground truths)
- `process/analyst/requirements-v3.md` (current requirements list -- append REQ-020, REQ-021, REQ-022)
- `process/architect/architecture-overview-v1.md` (architectural context)
- `process/architect/adr/ADR-004` (note data model -- relevant to export and tagging)
- `process/architect/adr/ADR-003` (folder model -- relevant to understanding existing organizational structures before adding tags)
- `process/architect/adr/ADR-008` (design tokens -- relevant to Reading Mode UI)
**Produce:** Updated `process/analyst/requirements-v4.md` containing all existing requirements (REQ-001 through REQ-019, unchanged) plus REQ-020, REQ-021, and REQ-022. Each new requirement must follow the existing format: Statement, Origin, Definition of Done, Priority, Status (Draft), and Acceptance Scenarios in Given/When/Then format.
**Iteration:** N/A (not in an iterate loop -- one-shot requirement creation)
**Verifier mode:** N/A (Analyst output, not Verifier invocation)
**Return to:** Orchestrator when complete

## Context for the Analyst

Three features were requested by stakeholders during the Cycle 2 demo:

### REQ-020: Full export to ZIP
- Feature: Export all notes at once as a ZIP archive. Currently only single-note Markdown export exists (REQ-019 / TASK-026).
- Rationale: Bulk data portability. Users with many notes should not have to export them one at a time.
- Consider: What is in the ZIP? Flat list of .md files? Folder structure preserved? What about filename collisions (multiple notes with same title)? Should version history be included or just current content?
- Priority: Should Have (convenience feature, extends existing export capability)

### REQ-021: Global tagging system
- Feature: Tag notes with user-defined labels. Filter and browse notes by tag.
- Rationale: Cross-cutting organization beyond folders. A note can belong to one folder but may relate to multiple topics. Tags provide that many-to-many relationship.
- Consider: How do tags interact with search (REQ-010)? Are tags per-user or shared? How are tags created (inline while editing, or separate management)? Tag naming constraints (length, characters)? How do tags appear in the sidebar catalog (REQ-008)?
- Priority: Should Have (organizational enhancement)

### REQ-022: Reading Mode
- Feature: A distraction-free reading view for notes. Rendered Markdown only -- no editor chrome, no sidebar, no split-pane. Just the content.
- Rationale: When reviewing notes, the editing interface is distracting. A clean reading view improves the consumption experience.
- Consider: How is Reading Mode entered and exited? Toggle button? Keyboard shortcut (REQ-018 already defines shortcut patterns)? Does it apply to single notes or could it be used for sequential reading? What about navigation between notes while in reading mode?
- Priority: Should Have (UX enhancement)

### What to produce

1. Requirements v4 -- the full requirements document with REQ-020, REQ-021, and REQ-022 appended. Do not modify existing requirements (REQ-001 through REQ-019). Add a changelog entry for v4.
2. If any clarification is needed from the Nexus, note the open question in the requirement and mark it clearly. Do not block on it -- produce the best-effort requirement and flag the question.
3. Include Handoff Notes for the Auditor highlighting what changed and any areas of uncertainty.

### What happens after

After the Analyst returns requirements-v4.md, the Orchestrator will route to the Auditor for audit of the three new requirements (regression check against existing requirements, internal consistency, acceptance scenario completeness). After Auditor PASS, the Requirements Gate is presented to the Nexus.
