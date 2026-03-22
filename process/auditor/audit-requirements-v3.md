# Audit Report -- Requirements -- BrainDump
**Audit Version:** 3 | **Date:** 2026-03-21 | **Artifact Weight:** Draft
**Requirements Version Audited:** 3 (REQ-018 and REQ-019 only -- targeted audit) | **Brief Version Referenced:** 2
**Profile:** Commercial | **Prior Approved Version:** Requirements v2 (regression baseline)
**Previous Audit:** audit-requirements-v2.md (PASS WITH DEFERRALS -- 17 requirements clean, 1 tracked deferral)

---

## Result: PASS WITH NOTES

**2 requirements audited (targeted scope). 2 passed all five checks (consistency, completeness, coherence, traceability, testability). 0 blocking issues. 3 non-blocking notes for Builder awareness.**

---

## Audit Scope

This is a targeted mid-cycle audit of two new requirements added in requirements-v3.md. No existing requirements (REQ-001 through REQ-017) were modified in v3. The scope is limited to REQ-018 and REQ-019 per the Orchestrator's routing instruction.

---

## REQ-018: Keyboard Shortcuts

### Consistency -- PASS

Checked against all 17 existing requirements. No contradictions found.

**REQ-018 Cmd/Ctrl+S vs. REQ-015 (auto-save):** These are complementary, not contradictory. REQ-015 states auto-save fires on a debounce timer and that "no manual save action is required." REQ-018 adds a manual save as an optional complement. The REQ-018 scenario explicitly states "manual save complement to auto-save." The auto-save mechanism continues to operate independently. A user who never uses Cmd/Ctrl+S loses nothing -- auto-save still fires. A user who presses Cmd/Ctrl+S gets an immediate save without waiting for the debounce. No conflict.

**REQ-018 Cmd/Ctrl+N vs. REQ-004 (create a note):** REQ-004 defines the note creation flow: user creates a note with a title, the note is persisted and opens in the editor. REQ-018 specifies that Cmd/Ctrl+N "creates a new note and opens it in the editor." This is a shortcut to the same flow defined in REQ-004. However, REQ-004 requires the user to "provide a title" at creation time. REQ-018's scenario says "a new note is created and opened in the editor" without specifying how the title is provided. This is acceptable -- REQ-018 triggers the same creation flow; the title input mechanism (modal, inline field, default title) is a Builder implementation detail that REQ-004 already governs. No conflict.

**REQ-018 Cmd/Ctrl+K vs. REQ-010 (full-text search):** REQ-010 defines the search capability. REQ-018 adds a keyboard shortcut to focus the search input. These are complementary. No conflict.

**Browser default override (Cmd/Ctrl+K):** The requirement explicitly acknowledges this override in scenario 8 ("the browser's default address-bar-focus behavior is prevented") and the Analyst flagged it for scrutiny. This is a well-established pattern in web applications (VS Code, Notion, Slack, GitHub). The requirement also includes a screen reader non-interference scenario (scenario 9) and explicitly excludes dangerous browser shortcuts from the shortcut set (the fitness function bullet states "Cmd/Ctrl+W, Cmd/Ctrl+T, Cmd/Ctrl+L are not used"). This is sound.

**Browser defaults not overridden:** The fitness function section explicitly states the shortcut set does NOT include Cmd/Ctrl+W (close tab), Cmd/Ctrl+T (new tab), or Cmd/Ctrl+L (address bar). This is the correct exclusion list. Cmd/Ctrl+S and Cmd/Ctrl+K are safe to override (both are commonly overridden by web applications). Cmd/Ctrl+N is also commonly overridden, though some browsers use it for "new window." The requirement specifies the shortcut only fires when "not focused on a text input," which limits unintended activation. Acceptable.

### Completeness -- PASS

10 acceptance scenarios cover:
1. Cmd/Ctrl+S -- manual save (positive case)
2. Cmd/Ctrl+N -- new note (positive case, scoped to non-text-input focus)
3. Cmd/Ctrl+K -- focus search (positive case)
4. Cmd/Ctrl+B -- bold toggle (positive case with toggle behavior)
5. Cmd/Ctrl+I -- italic toggle (positive case with toggle behavior)
6. Escape -- close overlay (positive case with focus restoration)
7. `?` key -- shortcut reference overlay (positive case)
8. Cmd/Ctrl+K browser override (explicit conflict handling)
9. Screen reader non-interference (accessibility)
10. Shortcut reference content (discoverability)

All scenarios are testable with standard DOM event simulation (fireEvent/userEvent in testing-library or Playwright keyboard actions). Each scenario has a clear Given/When/Then structure with a deterministic expected outcome.

The Definition of Done specifies the implementation mechanism (`useKeyboardShortcuts` hook, `preventDefault` for handled shortcuts). This is appropriate -- it prevents scattered event listeners and ensures centralized shortcut management.

No completeness gaps identified.

### Coherence -- PASS

The requirement addresses a real need for the target audience (technical professionals who prefer keyboard-driven workflows) and traces to the Brief's Ground Truths and Persona. The scope is appropriate for Should Have priority -- it enhances productivity without being essential for core functionality.

### Traceability -- PASS

- **Origin:** Nexus feature request at Cycle 2 Plan Gate -- confirmed in task-plan-v2.md (TASK-025 Nexus flag).
- **Brief v2 trace:** Ground Truths ("target audience: technical professionals"), Persona (Carla the Writer -- "reducing friction between thinking and writing"). Valid traces.
- **Task plan trace:** Closes the traceability gap flagged by the Planner for TASK-025. Confirmed.
- **Traceability table:** REQ-018 is present in the traceability summary table (line 610). Correct.

### Testability -- PASS

All 10 scenarios are deterministic and testable:
- Keyboard shortcuts can be tested via `fireEvent.keyDown` / `userEvent.keyboard` in unit tests and `page.keyboard.press` in Playwright.
- Toggle behavior (bold/italic) is verifiable by inspecting the editor content before and after.
- Browser default override is verifiable by checking that the default action does not fire (search input receives focus instead of address bar).
- Screen reader non-interference is testable by verifying that the hook does not bind to arrow keys, Tab, or single-letter navigation keys.
- Shortcut reference overlay content is verifiable by rendering the overlay and asserting the presence of all shortcut entries.

---

## REQ-019: Export Notes as Markdown

### Consistency -- PASS

Checked against all 17 existing requirements. No contradictions found.

**REQ-019 export vs. architecture's API-first approach:** The architecture (ADR-001) is an Express backend with a React frontend. REQ-019 explicitly specifies client-side-only export ("no server round-trip," "Blob + URL.createObjectURL"). This does not conflict with the API-first approach -- it simply does not use the API for this particular operation. The note content is already loaded in the editor (fetched via API when the note was opened). Export reuses the in-memory content. No new API endpoint is required. No conflict with any ADR.

**REQ-019 export vs. Brief v2 "out of scope":** Brief v2 Open Question 2 / Out of Scope states "Import/export from third-party services (may be revisited)." The Analyst correctly notes (line 634-635) that the Nexus's Cycle 2 Plan Gate request supersedes this earlier scoping decision. The Brief's out-of-scope item refers to import/export with third-party services, while REQ-019 is a local file download of the user's own content. These are different operations. Even if they were the same, the Nexus's explicit request takes precedence. No conflict.

**REQ-019 ownership guard vs. REQ-011 (per-user data isolation):** REQ-019 scenario 7 specifies that the Export button is "not visible or disabled" for notes the user does not own. This aligns with REQ-011's isolation model. No conflict.

### Completeness -- PASS

7 acceptance scenarios cover:
1. Happy path export (title-derived filename, raw Markdown content)
2. Filename sanitization with special characters (concrete example provided)
3. Empty body edge case (file still downloads -- does not fail silently)
4. Client-side-only constraint (no backend network request)
5. Toolbar placement (visible alongside Save, History, Delete)
6. Long title truncation (100-character limit before `.md` extension)
7. Ownership guard (export respects same rules as edit/delete)

**Empty body behavior (Analyst uncertainty flag):** The Analyst flagged uncertainty about whether an empty-body export should produce an empty file or one with the title as a heading. The scenario as written is: "a .md file is still downloaded (containing no body content or only the title as a heading)." This gives the Builder two acceptable implementations. At Draft weight, this is acceptable -- the key constraint is that the export does not fail or silently do nothing, which is clearly stated. The Builder can choose the simpler implementation (empty file) and the Nexus can refine at Demo Sign-off if they prefer the title-as-heading approach.

No completeness gaps identified.

### Coherence -- PASS

The requirement addresses data portability -- a legitimate need for a note-taking application that stores content in Markdown. The client-side-only approach is sound: the note content is already in the browser's memory when the user is editing, so a server round-trip would be wasteful. The Blob API approach is the standard browser mechanism for this pattern. The filename sanitization rules are well-specified (special chars removed, spaces to hyphens, lowercase, 100-char truncation).

### Traceability -- PASS

- **Origin:** Nexus feature request at Cycle 2 Plan Gate -- confirmed in task-plan-v2.md (TASK-026 Nexus flag).
- **Brief v2 trace:** Problem Statement ("removing friction, data portability"), Domain Invariants ("Note stores CommonMark Markdown source as the authoritative content"). Valid traces.
- **Task plan trace:** Closes the traceability gap flagged by the Planner for TASK-026. Confirmed.
- **Traceability table:** REQ-019 is present in the traceability summary table (line 611). Correct.

### Testability -- PASS

All 7 scenarios are deterministic and testable:
- File download can be tested by mocking `URL.createObjectURL` and `document.createElement('a')` and verifying the Blob content and filename.
- Filename sanitization is a pure function -- testable with unit tests against the specific examples given.
- Client-side-only constraint is verifiable by asserting no `fetch`/`XMLHttpRequest` calls are made during export (e.g., spy on fetch).
- Toolbar placement is verifiable via component rendering tests.
- Ownership guard is verifiable by checking button visibility/disabled state based on ownership context.
- Long title truncation is verifiable with a 200-character title input and asserting the output is <= 100 characters plus `.md`.

---

## Fitness Function Traceability

REQ-018 and REQ-019 each include a "Fitness Functions" section with inline bullet points labeled "(from TASK-025)" and "(from TASK-026)." These fitness functions are **not assigned FF-D IDs** from the fitness-functions.md index. The current index goes up to FF-D43.

This is a traceability observation, not a blocking issue. The fitness functions are well-defined and testable. At Draft weight, the Builder and Verifier can reference them by requirement ID and description. The FF-D IDs should be assigned when the fitness-functions.md index is next updated (likely during TASK-020, which is the fitness function instrumentation task).

**Note for Orchestrator:** When TASK-020 (fitness function instrumentation) is executed, the Architect or Builder should assign FF-D44 through FF-D51 (or similar) for the eight fitness function bullets across REQ-018 and REQ-019, and update the fitness-functions.md index accordingly.

---

## Regression Check

**Baseline:** Requirements v2 (17 requirements, all passed audit v2)
**Result:** No regressions.

- No existing requirements (REQ-001 through REQ-017) were modified in v3.
- REQ-018 (keyboard shortcuts) adds new functionality that does not invalidate any existing acceptance scenario. The `useKeyboardShortcuts` hook is a new component that intercepts specific key combinations; it does not modify the behavior of existing UI components (editor, sidebar, auto-save, version timer).
- REQ-019 (export) adds a new button to the editor toolbar and a new client-side download flow. It does not modify any existing toolbar action (Save, History, Delete) or any existing API behavior.
- Existing tests (verified by file listing): no test file references keyboard shortcut behavior or export functionality. No existing test assertion depends on the absence of these features (e.g., no test asserts "the toolbar has exactly 3 buttons").

No regression flags.

---

## Prior Deferral Review

**AUDIT-003 (DEFERRED): Professional/technical design aesthetic** -- carried forward from audit v2. Still valid, still non-blocking. REQ-018's shortcut reference overlay and REQ-019's Export button are new UI surfaces that should conform to the aesthetic. The Brief's Ground Truth and ADR-008's Tailwind token system provide sufficient guidance at Draft weight. No change in status.

---

## Detailed Pass/Fail Table

| REQ | Title | Priority | Consistency | Completeness | Coherence | Traceability | Testability | Result |
|---|---|---|---|---|---|---|---|---|
| REQ-018 | Keyboard shortcuts | Should Have | Pass | Pass | Pass | Pass | Pass (10 scenarios) | PASS |
| REQ-019 | Export notes as Markdown | Should Have | Pass | Pass | Pass | Pass | Pass (7 scenarios) | PASS |

**Total new scenarios:** 17

---

## Non-Blocking Notes

### NOTE-001: Fitness function IDs not yet assigned
**Requirements:** REQ-018, REQ-019
**Description:** The fitness functions listed in both requirements are described as prose bullet points without FF-D IDs from the fitness-functions.md index. This does not block the Builder, but the IDs should be assigned during TASK-020 (fitness function instrumentation) to maintain the traceability chain from requirement to fitness function to automated test.
**Action:** Architect or Builder assigns FF-D IDs during TASK-020.

### NOTE-002: REQ-019 empty body export -- two acceptable behaviors specified
**Requirement:** REQ-019
**Description:** The empty body scenario permits two implementations: an empty `.md` file or a file containing only the title as a heading. The Analyst flagged this for scrutiny. At Draft weight, this is acceptable -- the constraint that matters (export does not fail silently) is unambiguous. The Builder should pick one and the Nexus can refine at Demo Sign-off.
**Action:** Builder chooses one implementation. No Analyst revision needed.

### NOTE-003: REQ-018 Cmd/Ctrl+N -- title input mechanism unspecified
**Requirement:** REQ-018
**Description:** REQ-018 scenario 2 says "a new note is created and opened in the editor" via Cmd/Ctrl+N, but does not specify how the title is provided (modal prompt, default title, inline field). REQ-004 governs the creation flow and requires "providing a title." The Builder should ensure the shortcut triggers the same creation flow as REQ-004, including the title input step.
**Action:** Builder implements Cmd/Ctrl+N to invoke the existing note creation flow (REQ-004).

---

## Recommendation

**PASS WITH NOTES -- Builder may proceed with TASK-025 and TASK-026.**

Both requirements (REQ-018, REQ-019) have passed all five audit checks. No blocking issues. No regressions against v2. Three non-blocking notes are recorded for Builder awareness.

**No mandatory changes required before Builder begins.**

**Tracked deferral (carried forward):**
- AUDIT-003: Professional/technical design aesthetic -- non-blocking, to be reviewed at subsequent gates.

**Return to:** Orchestrator with PASS signal. Builder is unblocked for TASK-025 and TASK-026.
