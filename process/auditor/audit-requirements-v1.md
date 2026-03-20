# Audit Report -- Requirements -- BrainDump
**Audit Version:** 1 | **Date:** 2026-03-19 | **Artifact Weight:** Draft
**Requirements Version Audited:** 2 | **Brief Version Referenced:** 2
**Profile:** Commercial | **Prior Approved Version:** Requirements v1 (regression baseline)

---

## Result: ISSUES FOUND

**16 requirements audited. 13 passed all checks. 3 issues found: 1 gap, 1 ambiguity, 1 deferred.**

---

## Issues

### AUDIT-001: GAP -- No requirement for the public landing page (Anonymous Visitor)
**Flag:** [GAP]
**Brief sections involved:** User Roles (Anonymous Visitor -- "Learn about BrainDump, register for an account," "View public pages, register"), Open Question 3 resolution ("A minimal public landing page with registration/login is assumed")
**Requirements involved:** REQ-001 (registration), REQ-002 (login) -- neither covers the public-facing page itself
**Description:** The Brief defines an "Anonymous Visitor" user role whose goal is to "learn about BrainDump" and whose permissions include "view public pages." Open Question 3's resolution explicitly states that "a minimal public landing page with registration/login is assumed." REQ-001 covers the registration action and REQ-002 covers the login action, but no requirement exists for the public page that an unauthenticated visitor lands on. This page is the entry point to the entire application and the sole surface through which the Anonymous Visitor role exercises its stated goals. Without it, there is no requirement governing what an unauthenticated user sees when they arrive at BrainDump.
**Resolution needed:** The Analyst should add a requirement (or explicitly extend REQ-001/REQ-002) to cover the public landing page that provides registration and login access to anonymous visitors, consistent with the Brief's User Roles table and Open Question 3 resolution. If the Analyst and Nexus consider this implicit in REQ-001/REQ-002, it should be made explicit in those requirements' statements and scenarios.

---

### AUDIT-002: AMBIGUOUS -- "Meaningfully changed" and "significant diff" are undefined in REQ-016
**Flag:** [AMBIGUOUS]
**Requirements involved:** REQ-016 (Note version history)
**Description:** REQ-016 states that a new version is created when "the content has meaningfully changed compared to the last saved version (significant diff check)." The acceptance scenarios test for the presence or absence of meaningful change but do not define what constitutes it. Is a single-character addition meaningful? Is a whitespace-only change meaningful? Is adding then removing the same text (net-zero diff) meaningful? The Verifier cannot write a deterministic test for version creation without a definition of the diff threshold. The Brief uses the same language ("significant diff detected") without further specificity.
**Resolution needed:** The Analyst should define "meaningful change" with enough precision for the Verifier to write a pass/fail test. At minimum: (a) state whether any non-empty diff qualifies, or whether there is a minimum change threshold; (b) state whether whitespace-only changes qualify. A simple resolution would be: "any change to the note's title or body content (including whitespace changes) constitutes a meaningful change" -- which makes the diff check a simple equality check against the previous version. If the Nexus intends a more sophisticated threshold, that must be specified.

---

### AUDIT-003: DEFERRED -- Professional/technical design aesthetic has no standalone requirement
**Flag:** [DEFERRED]
**Brief sections involved:** Ground Truths ("Professional/technical design aesthetic -- applies to all UI surfaces: the catalog, the editor, and the search results")
**Requirements involved:** REQ-007 (mentions "professional/technical in aesthetic" in DoD), REQ-008 (no mention), REQ-010 (no mention), REQ-013 (no mention)
**What is being deferred:** A cross-cutting requirement that all UI surfaces conform to the professional/technical design aesthetic stated in the Brief's Ground Truths.
**Why deferral is acceptable now:** REQ-007 captures this for the editor, which is the primary UI surface. The aesthetic is a design constraint rather than a functional behavior, and the Brief states that the Designer agent is skipped (per Manifest) with UX implemented directly by the Builder from requirements. At Draft artifact weight, this constraint is sufficiently communicated through the Brief's Ground Truths and REQ-007's DoD. The Builder has access to the Brief and will apply the aesthetic consistently.
**When it must be resolved:** If the project moves to a higher artifact weight (Blueprint or Spec), a standalone NFR for design aesthetic should be created with testable criteria. For Commercial/Draft, this deferral is acceptable.

---

## Regression Check

**Baseline:** Requirements v1 (14 requirements: REQ-001 through REQ-014)
**Result:** No regressions found.

| v1 Requirement | v2 Status | Regression? |
|---|---|---|
| REQ-001 (Registration) | Unchanged in substance | No |
| REQ-002 (Login/Logout) | Unchanged in substance | No |
| REQ-003 (Password reset) | Promoted Should Have to Must Have; anti-enumeration scenario added | No -- strengthened, not contradicted |
| REQ-004 (Create note) | Updated to reference split-pane editor | No -- extended, compatible |
| REQ-005 (Edit note) | Updated to reference split-pane and auto-save | No -- extended, compatible |
| REQ-006 (Delete note) | Updated to include version deletion | No -- extended, compatible |
| REQ-007 (Markdown rendering) | Rewritten as split-pane live editor | No -- subsumes v1 rendering requirement |
| REQ-008 (List notes) | Rewritten as catalog sidebar | No -- subsumes v1 list functionality |
| REQ-009 (Folders) | Clarified single-level constraint | No -- restriction already implied in v1 |
| REQ-010 (Search) | Promoted Should Have to Must Have; PostgreSQL FTS specified | No -- strengthened, not contradicted |
| REQ-011 (Data isolation) | Extended to include note versions | No -- extended, compatible |
| REQ-012 (Durability) | PostgreSQL named explicitly; referential integrity added | No -- strengthened, compatible |
| REQ-013 (Responsive) | Updated with split-pane degradation guidance | No -- extended, compatible |
| REQ-014 (Account deletion) | Updated to include version deletion | No -- extended, compatible |

New requirements REQ-015 (auto-save) and REQ-016 (version history) do not conflict with any v1-approved requirement.

---

## Detailed Requirement-by-Requirement Audit

### Passed Requirements

| REQ | Consistency | Completeness | Coherence | Traceability | Testability | Result |
|---|---|---|---|---|---|---|
| REQ-001 | No conflicts | Complete | Coherent | Brief: Stakeholders, Domain Model | 2 scenarios, testable | PASS |
| REQ-002 | No conflicts | Complete | Coherent | Brief: User Roles | 3 scenarios, testable | PASS |
| REQ-003 | No conflicts | Complete | Coherent | Brief: OQ4, Ground Truths | 4 scenarios, testable; anti-enumeration is well specified | PASS |
| REQ-004 | No conflicts; references REQ-008 correctly | Complete | Coherent | Brief: Problem Statement, Scope | 2 scenarios, testable | PASS |
| REQ-005 | No conflicts; references REQ-015 correctly | Complete | Coherent | Brief: Scope, Ground Truths | 3 scenarios, testable | PASS |
| REQ-006 | No conflicts; consistent with REQ-016 on version deletion | Complete | Coherent | Brief: Scope, Domain Invariants | 3 scenarios, testable | PASS |
| REQ-007 | No conflicts; responsive degradation consistent with REQ-013 | Complete | Coherent; Carla persona validates non-developer usability | Brief: Ground Truths, Persona | 6 scenarios, testable; "no perceptible delay" acceptable at Draft weight | PASS |
| REQ-008 | No conflicts | Complete | Coherent; Carla persona validates large-collection readability | Brief: Ground Truths, Scope, Persona | 5 scenarios, testable | PASS |
| REQ-009 | No conflicts | Complete | Coherent | Brief: Scope, Domain Model, OQ1 | 4 scenarios, testable; nesting prohibition is explicit | PASS |
| REQ-010 | No conflicts | Complete | Coherent; PostgreSQL FTS matches Brief constraint | Brief: Ground Truths, Persona | 6 scenarios, testable; dual-field coverage verified | PASS |
| REQ-011 | No conflicts | Complete | Coherent | Brief: Domain Invariants, Ground Truths | 3 scenarios, testable | PASS |
| REQ-012 | No conflicts | Complete | Coherent | Brief: Ground Truths, Manifest | 3 scenarios, testable | PASS |
| REQ-013 | No conflicts; consistent with REQ-007 mobile degradation | Complete | Coherent | Brief: Delivery Channel | 3 scenarios, testable | PASS |
| REQ-014 | No conflicts; consistent with REQ-011 data removal | Complete | Coherent | Brief: Ground Truths, OQ5 | 2 scenarios, testable | PASS |
| REQ-015 | No conflicts; boundary with REQ-016 is well defined | Complete | Coherent | Brief: Ground Truths | 5 scenarios, testable | PASS |

### Requirements with Issues

| REQ | Check failed | Issue |
|---|---|---|
| REQ-016 | Testability | AUDIT-002: "meaningfully changed" is undefined -- Verifier cannot write deterministic tests |

### Brief Needs with No Requirement

| Brief Need | Issue |
|---|---|
| Anonymous Visitor public landing page | AUDIT-001: [GAP] |
| Professional/technical design aesthetic (all surfaces) | AUDIT-003: [DEFERRED] |

---

## Observations (Non-Blocking)

1. **REQ-015 debounce period is unspecified.** The DoD says "after a brief debounce period" without specifying a duration. At Draft weight, this is acceptable as a Builder implementation detail -- the scenarios test the behavior (save occurs after typing stops) rather than the timing. If the Nexus has a strong preference on debounce duration (e.g., 1 second vs. 5 seconds), it should be stated. Not flagged as blocking.

2. **REQ-008 and REQ-009 interaction.** The catalog sidebar (REQ-008) lists notes but does not describe how folders (REQ-009) are displayed within it. Since REQ-009 is Should Have and REQ-008 is Must Have, the catalog must work without folders. The integration of folders into the catalog view is a Builder/Architect decision. Not flagged as blocking.

3. **REQ-010 search results display.** The requirement specifies that results are "ranked by relevance" but does not describe the search results UI (e.g., do results appear in the catalog sidebar, in a separate panel, or in an overlay?). At Draft weight, this is a Builder decision. Not flagged as blocking.

4. **Carla the Writer traceability is strong.** REQ-007, REQ-008, and REQ-010 all explicitly reference Carla's persona and include scenarios derived from her usage patterns. REQ-012 and REQ-015/016 address her data durability need. This is well done.

---

## Recommendation

**RETURN TO ANALYST** -- two blocking issues must be resolved before the Requirements Gate:

1. **AUDIT-001 [GAP]:** Add a requirement for the public landing page, or explicitly extend REQ-001/REQ-002 to cover the Anonymous Visitor's entry point. This is a straightforward addition.

2. **AUDIT-002 [AMBIGUOUS]:** Define "meaningfully changed" in REQ-016 with enough precision for the Verifier to write deterministic acceptance tests. A simple "any diff" definition would suffice if that is the Nexus's intent.

**AUDIT-003 [DEFERRED]** does not block the gate. It is tracked for review at the Architecture Gate.

Once AUDIT-001 and AUDIT-002 are resolved, the requirements are ready for re-audit.
