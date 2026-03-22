# Routing Instruction
**To:** Analyst
**Phase:** Cycle 2 Execution -- mid-cycle requirement creation
**Task:** Produce REQ-018 (keyboard shortcuts) and REQ-019 (export notes as Markdown). These are new features requested by the Nexus at Plan Gate (Cycle 2) that were accepted into the task plan without approved requirements. The Planner flagged this traceability gap and recommended the Analyst produce formal requirements before the Builder begins TASK-025 and TASK-026.
**Load these artifacts:**
- `process/analyst/brief-v2.md` (Domain Model and audience context)
- `process/analyst/requirements-v2.md` (current requirements list -- append REQ-018 and REQ-019)
- `process/planner/task-plan-v2.md` (TASK-025 and TASK-026 sections contain the Planner's preliminary acceptance criteria -- use as input, not as the final requirement)
- `process/architect/architecture-overview-v1.md` (for architectural context on interaction patterns and data model)
- `process/architect/adr/ADR-008` (design tokens and interaction patterns -- relevant to keyboard shortcuts)
- `process/architect/adr/ADR-004` (note data model -- relevant to export)
**Produce:** Updated `process/analyst/requirements-v3.md` containing all existing requirements plus REQ-018 and REQ-019. Each new requirement must follow the existing format: Statement, Origin, Definition of Done, Priority (Should Have for both -- Nexus-requested features not on the Must Have critical path), Status (Draft), and Acceptance Scenarios in Given/When/Then format.
**Iteration:** N/A (not in an iterate loop -- one-shot requirement creation)
**Verifier mode:** N/A (Analyst output, not Verifier invocation)
**Return to:** Orchestrator when complete

## Context for the Analyst

The Nexus requested two features at the Cycle 2 Plan Gate:

### REQ-018: Keyboard shortcuts
- Feature: productivity keyboard shortcuts for the workspace (save, new note, search focus, bold, italic, close overlay, help reference)
- Target audience: developers and technical professionals who prefer keyboard-driven workflows
- The Planner's preliminary AC for TASK-025 provides a good starting point but the Analyst should formalize these as proper acceptance scenarios and surface any edge cases or conflicts (e.g., browser default shortcuts that cannot be overridden, accessibility implications)
- Priority: Should Have (this release)

### REQ-019: Export notes as Markdown
- Feature: download a note as a `.md` file from the editor
- Rationale: data portability -- users should not feel locked into the platform
- The Planner's preliminary AC for TASK-026 provides a good starting point but the Analyst should formalize these and consider edge cases (e.g., empty notes, notes with special characters in titles, filename sanitization rules)
- Priority: Should Have (this release)

### What to produce

1. Requirements v3 -- the full requirements document with REQ-018 and REQ-019 appended. Do not modify existing requirements (REQ-001 through REQ-017). Add a changelog entry for v3.
2. If any clarification is needed from the Nexus, note the open question in the requirement and mark it clearly. Do not block on it -- produce the best-effort requirement and flag the question.

### What happens after

After the Analyst returns requirements-v3.md, the Orchestrator will route to the Auditor for a targeted audit of the two new requirements (regression check against existing requirements, internal consistency). After Auditor PASS, the Nexus will review and approve REQ-018 and REQ-019 before the Builder begins TASK-025 and TASK-026.
