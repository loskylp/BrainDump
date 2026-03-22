# Audit Report -- Architecture (Cycle 3 ADRs)
**Date:** 2026-03-21 | **Artifact Weight:** Draft
**ADRs audited:** ADR-010 (Tagging Schema), ADR-011 (Bulk Export)

---

## Verdict: PASS

Both ADRs are internally consistent, properly reference existing architecture (ADR-003 schema, ADR-005 search, ADR-006 isolation), and do not conflict with approved ADRs. No foundational assumptions changed.

---

### ADR-010: Tagging Schema -- PASS

**Strengths:**
- Normalized approach consistent with ADR-003
- CASCADE strategy consistent with existing tables
- UNIQUE(user_id, name) enforces per-user uniqueness at DB level
- Search vector integration (weight C) is a sensible default
- Per-user isolation properly references ADR-006

**Observations (non-blocking):**
- AUDIT-ARCH-C3-001: The search vector trigger update for tags requires careful implementation -- when tags are added/removed from a note, the note's search_vector must be refreshed. The ADR notes this but leaves the implementation approach (touch updated_at vs. separate trigger) to the Builder. This is acceptable.
- AUDIT-ARCH-C3-002: Tag names stored lowercase means display is always lowercase. If stakeholders later want original-case display (e.g., "JavaScript" not "javascript"), a schema change would be needed. Acceptable for v1.

---

### ADR-011: Bulk Export -- PASS

**Strengths:**
- Backend streaming approach is the correct choice for complete collection export
- Reuses REQ-019 filename sanitization rules -- consistent
- Security model properly inherits existing authentication and ownership patterns
- Empty collection handling is well-defined

**Observations (non-blocking):**
- AUDIT-ARCH-C3-003: The `archiver` npm package is recommended. The Builder should verify it is actively maintained and has no known vulnerabilities before adding it as a dependency.
- AUDIT-ARCH-C3-004: For very large collections (thousands of notes), the single query loading all note bodies into memory could be significant. Streaming the query results (cursor-based) would be more memory-efficient. Acceptable for v1 given the expected scale (hundreds of notes).

---

## Backward Impact Check

No foundational assumptions changed:
- Delivery channel: unchanged (Web)
- Deployment model: unchanged (monolith, Docker, nxlabs)
- Auth/identity model: unchanged (session-based)
- Data persistence strategy: extended (two new tables), not changed
- System boundary: unchanged

No backward cascade required. Proceed to Planner.
