# Routing Instruction
**To:** Auditor
**Phase:** Cycle 2 Execution -- mid-cycle requirement review
**Task:** Targeted audit of REQ-018 (Keyboard shortcuts) and REQ-019 (Export notes as Markdown). These are two new requirements added in requirements-v3.md by the Analyst to close traceability gaps flagged by the Planner at the Cycle 2 Plan Gate. No existing requirements (REQ-001 through REQ-017) were modified. This is NOT a full re-audit -- scope is limited to the two new requirements only.
**Load these artifacts:**
- `process/analyst/requirements-v3.md` -- the full requirements document; focus on REQ-018 and REQ-019 (lines 485-586) and the Handoff Notes for Auditor section (lines 615-636)
- `process/auditor/audit-requirements-v2.md` -- the prior audit report (PASS WITH DEFERRALS) for cross-reference; all prior flags (AUDIT-001, AUDIT-002) were resolved in v2
- `process/analyst/brief-v2.md` -- the Brief (domain model and vocabulary) for traceability validation
- `process/architect/architecture-overview-v1.md` -- the architecture for feasibility cross-check
- `process/planner/task-plan-v2.md` -- the Cycle 2 task plan containing TASK-025 and TASK-026 definitions that these requirements trace to
**Produce:** Audit report for REQ-018 and REQ-019 at `process/auditor/audit-requirements-v3.md`
**Iteration:** N/A (single-pass audit)
**Verifier mode:** N/A (Auditor, not Verifier)
**Return to:** Orchestrator when complete

---

## Audit Scope

Review REQ-018 and REQ-019 for:

1. **Internal consistency:** Do the new requirements conflict with any existing approved requirement (REQ-001 through REQ-017)? Pay particular attention to:
   - REQ-018 Cmd/Ctrl+S (manual save) vs REQ-015 (auto-save) -- are these complementary or contradictory?
   - REQ-018 Cmd/Ctrl+N (new note) vs REQ-004 (create a note) -- does the shortcut's behavior align with the existing create flow?
   - REQ-018 Cmd/Ctrl+K (focus search) vs REQ-010 (full-text search) -- any conflict with search UX?
   - REQ-019 export (client-side only) vs the architecture's API-first approach -- any tension?

2. **Completeness:** Are the acceptance scenarios testable and deterministic? The Analyst flagged two items for your attention:
   - REQ-018: Cmd/Ctrl+K overriding browser default address bar focus -- is this acceptable?
   - REQ-019: Empty body export behavior -- is the specification clear enough to test?

3. **Traceability:** Do both requirements trace cleanly to Brief v2 and the Nexus's Cycle 2 Plan Gate request?

4. **Regression check:** Since no existing requirements were modified, confirm that no existing acceptance scenario is invalidated by the addition of REQ-018 or REQ-019.

5. **Architectural feasibility:** Are both requirements implementable within the current architecture (React SPA with CodeMirror 6 editor, Express backend, client-side rendering)?

## Context

- The Nexus requested keyboard shortcuts and Markdown export at the Cycle 2 Plan Gate
- The Planner flagged TASK-025 and TASK-026 as untraced to approved requirements
- The Nexus accepted both features with the condition that requirements be created before Builder begins
- Both requirements are Should Have priority
- Builder is blocked on TASK-025 and TASK-026 pending this audit

## Expected Output

- PASS: Requirements are sound, Builder can proceed with TASK-025 and TASK-026
- PASS WITH FLAGS: Requirements are sound with noted items for awareness (non-blocking)
- FAIL with specific issues: Requirements need revision before Builder can proceed (route back to Analyst)
