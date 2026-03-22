# Audit Report -- Requirements v4
**Date:** 2026-03-21 | **Artifact Weight:** Draft
**Requirements version audited:** v4
**Scope:** Three new requirements (REQ-020, REQ-021, REQ-022) plus regression check against REQ-001 through REQ-019

---

## Verdict: PASS

No blocking issues found. Three new requirements are internally consistent, properly traced, and do not regress against existing approved requirements. Analyst-flagged uncertainties are appropriate for Nexus decision at the Requirements Gate.

---

## New Requirements Review

### REQ-020: Full export to ZIP -- PASS

**Strengths:**
- Natural extension of REQ-019 (single-note export) -- conceptually clean
- Filename collision resolution is well-specified (numeric suffix)
- Folder structure preservation correctly references REQ-009
- Same filename sanitization rules as REQ-019 -- consistent
- Performance scenario for 200 notes addresses scalability

**Observations (non-blocking):**
- AUDIT-V4-001: The requirement allows both client-side and server-side ZIP generation. This is an implementation decision that may warrant an ADR if the Architect determines that a backend endpoint is needed (it likely is -- fetching all note bodies from the API to build a ZIP client-side is inefficient for large collections). Flagged for Architect.
- AUDIT-V4-002: Version history is explicitly excluded from the ZIP export (current content only). This is a reasonable scoping decision but the Nexus should confirm.
- Empty collection scenario allows two behaviors ("disabled" or "empty ZIP with README"). The Planner should pick one during task decomposition.

**Regression check:** No conflicts with existing requirements. REQ-019 (single-note export) remains independent -- both exports can coexist.

---

### REQ-021: Global tagging system -- PASS

**Strengths:**
- Many-to-many relationship correctly modeled (junction table)
- Per-user isolation explicitly references REQ-011 -- consistent with data isolation model
- Independence from folders (REQ-009) clearly stated
- Case-insensitivity and character constraints are concrete and testable
- Tag badge display in catalog sidebar correctly references REQ-008

**Observations (non-blocking):**
- AUDIT-V4-003: OR vs AND filter logic. The requirement specifies OR (inclusive). This is the more common UX default for tag filtering. AND logic would be a power-user feature. The Nexus should confirm OR is the desired behavior. If AND is also needed, it could be a future enhancement.
- AUDIT-V4-004: Tag indexing in search vector. The requirement states tags appear in search result metadata but does not specify whether tag names should be searchable via REQ-010 full-text search. The Architect should decide whether to add tag names to the tsvector index. This is a schema/ADR decision, not a requirement gap.
- AUDIT-V4-005: The requirement specifies tags "may contain letters, numbers, hyphens, and spaces." It does not address Unicode characters (accented letters, CJK characters). Given the target audience (technical professionals who may have international content), the Auditor recommends allowing Unicode letters. Flagged for Nexus decision.
- AUDIT-V4-006: Schema impact -- a new `tags` table and `note_tags` junction table are needed. This requires a database migration and an ADR. The Architect must be routed before the Planner.

**Regression check:** No conflicts with existing requirements. Folders (REQ-009) and tags are independent organizational dimensions -- both can coexist. The catalog sidebar (REQ-008) will need UI extension to show tag badges and filter controls, but this is additive, not a breaking change. Search results (REQ-010) will display tag metadata alongside results -- additive. Per-user isolation (REQ-011) explicitly referenced and consistent.

---

### REQ-022: Reading mode -- PASS

**Strengths:**
- Clean separation from the editor (REQ-007) -- uses same renderer, different layout
- Keyboard shortcut (Cmd/Ctrl+Shift+R) properly integrates with REQ-018 shortcut system
- Escape behavior consistent with REQ-018 existing Escape pattern
- Navigation within reading mode (prev/next) adds genuine value without complexity
- Authentication guard scenario is consistent with all note functionality

**Observations (non-blocking):**
- AUDIT-V4-007: Cmd/Ctrl+Shift+R conflicts with browser hard refresh in some browsers (Chrome, Firefox on Windows/Linux). The Analyst noted this. The `preventDefault` approach used for Cmd/Ctrl+K in REQ-018 is the standard pattern and should work. Acceptable.
- AUDIT-V4-008: The requirement specifies prev/next navigation by "catalog order (by last modified date)." If the user has a tag filter active when entering reading mode, should the navigation respect that filter? The requirement does not specify. The Planner should clarify during task decomposition (reasonable default: navigate all notes regardless of active filter, since reading mode hides the sidebar).
- AUDIT-V4-009: Mobile reading mode. The requirement does not explicitly address mobile viewports (REQ-013). On mobile, reading mode is essentially the default view (single panel). The implementation should handle this gracefully -- likely reading mode on mobile is a no-op or simply hides the tab bar. Flagged for the Planner.

**Regression check:** No conflicts with existing requirements. The Escape key is already used by REQ-018 to close overlays -- reading mode exit via Escape is consistent (reading mode is conceptually an overlay/mode, not a persistent overlay). The toolbar button placement "alongside Save, History, Delete, Export" is additive.

---

## Cross-Requirement Consistency Check

| Check | Result |
|---|---|
| REQ-020 vs REQ-019 (single export) | Compatible -- bulk export extends single export, no conflict |
| REQ-020 vs REQ-009 (folders) | Compatible -- ZIP preserves folder structure |
| REQ-021 vs REQ-009 (folders) | Compatible -- explicitly independent dimensions |
| REQ-021 vs REQ-008 (sidebar) | Compatible -- tags add to sidebar, no breaking change |
| REQ-021 vs REQ-010 (search) | Compatible -- tags shown in search metadata |
| REQ-021 vs REQ-011 (isolation) | Compatible -- per-user tag namespace |
| REQ-022 vs REQ-007 (editor) | Compatible -- shares renderer, different layout |
| REQ-022 vs REQ-018 (shortcuts) | Compatible -- new shortcut Cmd/Ctrl+Shift+R, Escape consistent |
| REQ-022 vs REQ-013 (responsive) | Needs clarification (AUDIT-V4-009) |
| All three vs existing Must Haves | No regression |

---

## Recommendations for Downstream Agents

1. **Architect:** Must produce ADR for tagging schema (tags table, note_tags junction table, index strategy, search vector integration). Should also evaluate whether ZIP export needs a backend endpoint ADR.
2. **Planner:** Resolve the empty collection behavior for REQ-020 (pick one: disabled or empty ZIP). Clarify reading mode navigation scope (all notes or filtered set) for REQ-022. Address mobile reading mode interaction with REQ-013.
3. **Nexus at Requirements Gate:** Confirm OR filter logic for tags (REQ-021). Confirm version history exclusion from ZIP export (REQ-020). Decide on Unicode tag names (REQ-021).

---

## Summary

| Requirement | Verdict | Blocking Issues | Non-blocking Observations |
|---|---|---|---|
| REQ-020 | PASS | 0 | 2 (AUDIT-V4-001, AUDIT-V4-002) |
| REQ-021 | PASS | 0 | 4 (AUDIT-V4-003 through AUDIT-V4-006) |
| REQ-022 | PASS | 0 | 3 (AUDIT-V4-007 through AUDIT-V4-009) |
| **Total** | **PASS** | **0** | **9** |
