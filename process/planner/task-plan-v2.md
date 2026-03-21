# Task Plan -- BrainDump
**Version:** 2 | **Date:** 2026-03-21 | **Artifact Weight:** Draft
**Requirements version:** 2 | **Architecture version:** 1
**Plan scope:** Cycle 2

---

## Changelog
- v1: Initial task plan from 17 requirements (68 acceptance scenarios) -- 2026-03-19
- v2: Cycle 2 task plan. Cycle 1 complete (14/14 tasks PASS). Cycle 2 scope: 10 tasks covering search, password reset, folders, responsive design, keyboard shortcuts, export, rate limiting, DevOps Phase 2, fitness instrumentation, and account deletion. Two new features added (keyboard shortcuts TASK-025, export notes TASK-026) not traced to approved requirements -- flagged to Nexus. TASK-019 (account deletion) promoted from DEFERRED to Cycle 2 P2. TASK-018 (responsive design) moved from P3 to P2. -- 2026-03-21

---

## Cycle 1 -- Summary (CLOSED)

All 14 Cycle 1 tasks verified PASS. Walking skeleton delivered. Demo signed off 2026-03-21.

| Task | Requirement | Status |
|---|---|---|
| TASK-001 | DevOps Phase 1 | COMPLETE |
| TASK-002 | REQ-012, REQ-011 | COMPLETE |
| TASK-003 | REQ-001 | COMPLETE |
| TASK-004 | REQ-002 | COMPLETE |
| TASK-005 | REQ-011 | COMPLETE |
| TASK-006 | REQ-004 | COMPLETE |
| TASK-007 | REQ-007 | COMPLETE |
| TASK-008 | REQ-008 | COMPLETE |
| TASK-009 | REQ-005 | COMPLETE |
| TASK-010 | REQ-006 | COMPLETE |
| TASK-011 | REQ-017 | COMPLETE |
| TASK-012 | REQ-015 | COMPLETE |
| TASK-013 | REQ-016 | COMPLETE |
| TASK-016 | REQ-007, REQ-008, REQ-017 | COMPLETE |

---

## Cycle 2 -- Task Decomposition

### Legend

- **Status:** Pending | In Progress | Complete
- **Dependency notation:** `>>` means "must complete before"
- **Cycle 1 dependencies are satisfied:** All Cycle 1 tasks are COMPLETE

---

### TASK-024: Rate limiting on authentication endpoints (SEC-001)
**Requirement(s):** REQ-001, REQ-002 (security hardening)
**ADR(s):** ADR-002
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Well-understood middleware (`express-rate-limit`), no architectural unknowns. Proven technology in a familiar pattern (Low).
**Value justification:** Sentinel finding SEC-001 (High severity). Brute-force and credential stuffing protection for production auth endpoints. Deferred from Cycle 1 -- must not defer again. Directly addresses a validated security gap (High).
**Dependencies:** TASK-004 >> TASK-024 (satisfied)
**Source:** Sentinel Cycle 1 Security Report -- SEC-001
**Status:** Pending
**Acceptance Criteria:**
1. `express-rate-limit` is installed as a production dependency in `backend/package.json`
2. `POST /api/auth/login` is rate-limited to 10 requests per 15-minute window per IP address; exceeding the limit returns HTTP 429 with a clear error message
3. `POST /api/auth/register` is rate-limited to 10 requests per 15-minute window per IP address; exceeding the limit returns HTTP 429 with a clear error message
4. Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are included in responses to rate-limited endpoints
5. Rate limiter uses the default in-memory store (acceptable for single-instance deployment per ADR-001)
6. Existing authentication tests continue to pass (no regressions)
**Fitness Functions:** FF-D03, FF-D04

---

### TASK-014: Full-text search
**Requirement(s):** REQ-010
**ADR(s):** ADR-005, ADR-006
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** PostgreSQL FTS with tsvector/GIN is known technology but used here in a specific combination (weighted vectors, ts_headline, query sanitization). Two-way door per ADR-005 (Medium).
**Value justification:** Must Have for this release. Directly addresses validated user need (Carla's keyword search across hundreds of notes). Completes a core product promise advertised on the landing page (High).
**Dependencies:** TASK-002 >> TASK-014 (satisfied), TASK-005 >> TASK-014 (satisfied)
**Status:** Pending
**Acceptance Criteria:**
1. Search input in the UI accepts a text query and calls `GET /api/notes/search?q=:query`
2. `searchService` converts user input to a tsquery-safe format: split on whitespace, remove special chars, join with `&`, append `:*` to last term for prefix matching
3. Query uses the `search_vector` column with GIN index; no sequential scan
4. A note with "PostgreSQL" in the title is returned when searching for "PostgreSQL" (title field searched)
5. A note with "PostgreSQL" only in the body is returned when searching for "PostgreSQL" (body field searched)
6. Title match ranks higher than body-only match (weight A vs weight B)
7. Results include note title and a text snippet with highlighted matching terms (via `ts_headline`)
8. Search results scoped to authenticated user only (per-user isolation enforced)
9. Non-existent term returns empty results with a clear message
10. Search across 200 notes completes in < 200ms
**Fitness Functions:** FF-D19, FF-D20, FF-D21, FF-D22, FF-D23, FF-D24, FF-D25

---

### TASK-015: Password reset flow
**Requirement(s):** REQ-003
**ADR(s):** ADR-002
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** Involves external email service integration boundary and token-based flow. Known patterns but the email provider integration is an external dependency not fully documented (Medium).
**Value justification:** Must Have for this release. Without password reset, users who forget their password are permanently locked out. Critical for a public service where users rely on persistent data (High -- re-scored from Medium in v1 because this is now the last Must Have feature blocking MVP).
**Dependencies:** TASK-003 >> TASK-015 (satisfied)
**Status:** Pending
**Acceptance Criteria:**
1. A user can request a password reset by entering their email at `/forgot-password`
2. A `password_reset_tokens` row is created with `(token_hash, user_id, expires_at)`. Raw token is sent via email; only the hash is stored
3. The same success message is shown regardless of whether the email is registered (no user enumeration)
4. The `emailService` interface calls `sendPasswordResetEmail(to, resetUrl)`. In development, this logs to console. In production, it delegates to a configured provider
5. A user with a valid reset link can set a new password; the password is re-hashed with bcrypt
6. On successful reset, the token row is deleted and all existing sessions for that user are invalidated
7. Expired reset tokens (> 1 hour) are rejected with a prompt to request a new link
8. Used tokens cannot be reused
**Fitness Functions:** FF-D05, FF-D06

---

### TASK-017: Organize notes in folders
**Requirement(s):** REQ-009
**ADR(s):** ADR-003
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Standard CRUD on a well-defined schema with known patterns. Folder model already exists in the schema (created in TASK-002). No unknowns (Low).
**Value justification:** Should Have for this release. Organizational convenience feature. Not on the critical path but adds meaningful structure for users with many notes (Medium -- Should Have, this release).
**Dependencies:** TASK-006 >> TASK-017 (satisfied), TASK-005 >> TASK-017 (satisfied)
**Status:** Pending
**Acceptance Criteria:**
1. An authenticated user can create a folder with a valid name via `POST /api/folders`
2. Folder appears in the sidebar catalog navigation
3. An authenticated user can rename a folder via `PUT /api/folders/:id`
4. An authenticated user can move a note into a folder via `PUT /api/notes/:id` (setting folder_id)
5. A note can be moved out of a folder (setting folder_id to null)
6. Notes without a folder appear at root level in the catalog
7. Deleting a folder moves its notes to root level (folder_id becomes NULL via ON DELETE SET NULL)
8. Nested folder creation is not available (single-level only)
9. Ownership guard enforced: user cannot access another user's folders (404)
**Fitness Functions:** FF-D10, FF-D27

---

### TASK-021: DevOps Phase 2 -- staging environment and CD pipeline
**Requirement(s):** REQ-012, Manifest CD philosophy
**ADR(s):** ADR-007
**Priority Group:** P2 | **Risk:** Medium | **Value:** Medium
**Risk justification:** First deployment to nxlabs.cc infrastructure. Integrating with Traefik, Watchtower, and shared PostgreSQL is a new combination for this project (Medium).
**Value justification:** Enables continuous delivery flow. Staging environment is already live from Cycle 1 work (established as part of CI pipeline). This task formalizes the CD pipeline and environment contract. Required before Go-Live (Medium).
**Dependencies:** TASK-001 >> TASK-021 (satisfied)
**DevOps Phase:** 2
**Status:** Complete
**Note:** Staging environment is already operational at braindump.staging.nxlabs.cc (confirmed during Cycle 1 verification). This task focuses on formalizing the CD pipeline, environment documentation, and ensuring Watchtower-based auto-deployment is reliable and documented.
**Acceptance Criteria:**
1. Docker Compose file for staging at `/opt/braindump/docker-compose.staging.yml` per ADR-007
2. Staging database provisioned via `provision.sh braindump-staging` on nxlabs.cc
3. Staging environment `.env.staging` configured with staging database URL, session secret, and console email provider
4. Container joins `traefik` and `postgres` external Docker networks
5. Traefik routes `braindump.staging.nxlabs.cc` to the staging container via Docker labels
6. Watchtower picks up new `:staging` images and performs rolling restart
7. Uptime Kuma auto-registers via Docker labels and monitors health endpoint
8. Migrations run on container startup before the application server starts
**Fitness Functions:** FF-D33, FF-D34, FF-D43, FF-P01, FF-P15

---

### TASK-018: Responsive design -- tablet and mobile breakpoints
**Requirement(s):** REQ-013
**ADR(s):** ADR-009
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** CSS-only progressive collapse with media queries. Two-way door. No unknowns (Low).
**Value justification:** Should Have for this release. Extends usability to tablet and mobile users. Desktop is primary but mobile access matters for a public service (Medium -- Should Have, this release).
**Dependencies:** TASK-016 >> TASK-018 (satisfied), TASK-007 >> TASK-018 (satisfied), TASK-008 >> TASK-018 (satisfied)
**Status:** Pending
**Acceptance Criteria:**
1. At 768px-1023px: editor + preview visible; sidebar collapsed behind a hamburger toggle (top-left)
2. At < 768px: single panel visible at a time; tab bar ("Notes" / "Edit" / "Preview") for panel switching
3. Sidebar overlay on tablet (fixed position, slides in from left with 0.2s transition)
4. No horizontal scrollbar at 375px, 768px, 1024px, or 1920px viewport widths
5. All interactive elements have minimum 44px touch targets on viewports < 768px
6. Tab bar uses clear labels, not icons alone
**Fitness Functions:** FF-D38, FF-D39, FF-D40, FF-D41, FF-D42

---

### TASK-025: Keyboard shortcuts
**Requirement(s):** None (new feature request from Nexus, not in approved requirements v2)
**ADR(s):** ADR-008 (interaction patterns)
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Standard DOM event listeners with well-documented KeyboardEvent API. No architectural unknowns (Low).
**Value justification:** Productivity enhancement for the target audience (developers and technical professionals). Supports the professional/technical identity of BrainDump. Not traced to an approved requirement -- value is Medium as a usability improvement (Medium).
**Dependencies:** TASK-007 >> TASK-025 (satisfied -- editor must exist), TASK-006 >> TASK-025 (satisfied -- note creation must exist)
**Status:** Pending
**Nexus flag:** This task is not traced to an approved requirement in requirements-v2.md. If the Nexus wants this feature, the Analyst should produce a requirement (e.g., REQ-018) before the Builder begins. The Planner has included it in the plan at the Nexus's request but flags the traceability gap.
**Acceptance Criteria:**
1. `Ctrl/Cmd + S` triggers a manual save of the current note (complements auto-save)
2. `Ctrl/Cmd + N` creates a new note and opens it in the editor
3. `Ctrl/Cmd + K` focuses the search input (when search is available)
4. `Ctrl/Cmd + B` toggles bold formatting in the editor (wraps selection with `**`)
5. `Ctrl/Cmd + I` toggles italic formatting in the editor (wraps selection with `_`)
6. `Escape` closes any open overlay (sidebar on mobile, version history panel)
7. Shortcuts do not conflict with browser defaults that cannot be overridden
8. A keyboard shortcut reference is accessible from the workspace (e.g., `?` or help menu)

---

### TASK-026: Export notes as Markdown
**Requirement(s):** None (new feature request from Nexus, not in approved requirements v2)
**ADR(s):** ADR-004 (note data model)
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Standard Blob download via browser API. Note content is already stored as Markdown -- no transformation needed. No unknowns (Low).
**Value justification:** Data portability for users. Supports trust in the platform -- users are not locked in. Not traced to an approved requirement -- value is Medium as a trust and usability feature (Medium).
**Dependencies:** TASK-009 >> TASK-026 (satisfied -- note content must be editable/accessible)
**Status:** Pending
**Nexus flag:** This task is not traced to an approved requirement in requirements-v2.md. If the Nexus wants this feature, the Analyst should produce a requirement (e.g., REQ-019) before the Builder begins. The Planner has included it in the plan at the Nexus's request but flags the traceability gap.
**Acceptance Criteria:**
1. An authenticated user can export a single note as a `.md` file via a download button or menu option in the editor
2. The exported file contains the note's raw Markdown body with the note title as the filename (sanitized for filesystem safety)
3. The download uses the browser's native download mechanism (Blob URL + anchor click)
4. Export works without a round-trip to the server if the note content is already loaded in the editor
5. Export is available only for notes the user owns (ownership guard enforced)

---

### TASK-019: Account deletion
**Requirement(s):** REQ-014
**ADR(s):** ADR-002, ADR-003
**Priority Group:** P2 | **Risk:** Low | **Value:** Low
**Risk justification:** CASCADE deletes handle all cleanup at DB level. Standard flow with confirmation. No unknowns (Low).
**Value justification:** Should Have. Not on the critical path. Users rarely delete accounts, but for a public service, self-service account deletion is a reasonable expectation. Promoted from DEFERRED to Cycle 2 per Nexus decision at Cycle 1 Demo Sign-off (Low -- Should Have, low urgency).
**Dependencies:** TASK-003 >> TASK-019 (satisfied), TASK-004 >> TASK-019 (satisfied)
**Status:** Pending
**Acceptance Criteria:**
1. An authenticated user can initiate account deletion from account settings
2. A confirmation step prevents accidental deletion
3. On confirmation, the user's account, notes, versions, folders, reset tokens, and sessions are permanently deleted (CASCADE)
4. After deletion, the user cannot log in
5. Canceling the confirmation does not delete anything
**Fitness Functions:** FF-D09

---

### TASK-020: Fitness function instrumentation -- dev-side test suite
**Requirement(s):** Cross-cutting (all fitness functions from fitness-functions.md)
**ADR(s):** ADR-001 through ADR-009
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Writing tests against well-defined acceptance criteria and existing code. Known patterns (Low).
**Value justification:** Quality/resilience of existing features. Ensures fitness functions are automated in CI. Many FF checks were already written as acceptance tests within Cycle 1 tasks -- this task covers the comprehensive instrumentation pass for full coverage (Medium).
**Dependencies:** TASK-014 >> TASK-020 (search FF tests need search feature built first)
**Status:** Pending
**Acceptance Criteria:**
1. All FF-D01 through FF-D43 dev-side fitness functions are implemented as automated tests in the test suite
2. Tests are organized by ADR/concern area (auth, durability, auto-save, versioning, search, isolation, deploy, aesthetic, responsive)
3. CI pipeline runs all fitness function tests as part of the standard test suite
4. Each test references its FF-ID in a comment for traceability
5. Lighthouse CI audit integrated for FF-D02 (LCP, bundle size), FF-D36 (accessibility)
6. ESLint rule configured for FF-D37 (no inline styles overriding Tailwind)
7. CI flags changes to `tailwind.config.js` for review (FF-D35)

---

## Scoring Summary and Priority Matrix

### Scoring Table

| Task | Risk | Value | Priority | Justification Summary |
|---|---|---|---|---|
| TASK-024 | Low | High | P1 | SEC-001 deferred from Cycle 1. Security gap. Quick win -- schedule first. |
| TASK-014 | Medium | High | P1 | Must Have. Core product promise (search). |
| TASK-015 | Medium | High | P1 | Must Have. Last Must Have feature blocking MVP. |
| TASK-017 | Low | Medium | P2 | Should Have. Reliable value, no risk. |
| TASK-021 | Medium | Medium | P2 | CD pipeline formalization. Needed before Go-Live. |
| TASK-018 | Low | Medium | P2 | Should Have. Extends reach to mobile/tablet. |
| TASK-025 | Low | Medium | P2 | Productivity feature. Not traced to approved requirement. |
| TASK-026 | Low | Medium | P2 | Data portability. Not traced to approved requirement. |
| TASK-019 | Low | Low | P2 | Should Have. Promoted from DEFERRED per Nexus. |
| TASK-020 | Low | Medium | P2 | Quality instrumentation. Depends on TASK-014. |

### Priority Matrix Visualization

```
              |  HIGH VALUE          |  MEDIUM VALUE         |  LOW VALUE
--------------+----------------------+-----------------------+-----------------
HIGH RISK     |                      |                       |
--------------+----------------------+-----------------------+-----------------
MEDIUM RISK   |  P1: TASK-014,       |  P2: TASK-021         |
              |  TASK-015            |                       |
--------------+----------------------+-----------------------+-----------------
LOW RISK      |  P1: TASK-024        |  P2: TASK-017,        |  P2: TASK-019
              |                      |  TASK-018,            |
              |                      |  TASK-025,            |
              |                      |  TASK-026,            |
              |                      |  TASK-020             |
```

---

## Cycle 2 Execution Order

Dependencies from Cycle 1 are all satisfied. Within Cycle 2, the ordering is driven by priority group and then by risk/value within each group.

### P1 -- Do first

All Cycle 1 dependencies satisfied. No inter-task dependencies within P1. Schedule Low Risk before Medium Risk for momentum.

```
1. TASK-024  Rate limiting (Low Risk, High Value -- quick win, security debt)
2. TASK-014  Full-text search (Medium Risk, High Value -- Must Have)
3. TASK-015  Password reset (Medium Risk, High Value -- Must Have)
```

### P2 -- After P1

One dependency: TASK-020 depends on TASK-014 (search FF tests). All others are independent.

```
4. TASK-017  Folder organization (Low Risk, Medium Value -- reliable value)
5. TASK-021  DevOps Phase 2 (Medium Risk, Medium Value -- CD formalization)
6. TASK-018  Responsive design (Low Risk, Medium Value)
7. TASK-025  Keyboard shortcuts (Low Risk, Medium Value)
8. TASK-026  Export notes (Low Risk, Medium Value)
9. TASK-019  Account deletion (Low Risk, Low Value)
10. TASK-020  Fitness function instrumentation (Low Risk, Medium Value -- after TASK-014)
```

### Dependency Graph

```
TASK-024 (rate limiting)         -- no Cycle 2 dependencies
TASK-014 (search)                -- no Cycle 2 dependencies
TASK-015 (password reset)        -- no Cycle 2 dependencies
TASK-017 (folders)               -- no Cycle 2 dependencies
TASK-021 (DevOps Phase 2)        -- no Cycle 2 dependencies
TASK-018 (responsive)            -- no Cycle 2 dependencies
TASK-025 (keyboard shortcuts)    -- no Cycle 2 dependencies
TASK-026 (export)                -- no Cycle 2 dependencies
TASK-019 (account deletion)      -- no Cycle 2 dependencies
TASK-020 (fitness instrumentation) -- TASK-014 >> TASK-020
```

### Linear Execution Order for Builder

```
 1. TASK-024  Rate limiting on auth endpoints
 2. TASK-014  Full-text search
 3. TASK-015  Password reset flow
 4. TASK-017  Folder organization
 5. TASK-021  DevOps Phase 2 (DevOps agent, not Builder)
 6. TASK-018  Responsive design
 7. TASK-025  Keyboard shortcuts
 8. TASK-026  Export notes as Markdown
 9. TASK-019  Account deletion
10. TASK-020  Fitness function instrumentation
```

**Scaffolder invocation:** Cycle 2 has 9 Builder tasks (>= 3 threshold), so the Scaffolder is invoked before the first Builder task.

**OBS-V004-05 action:** Route to DevOps during TASK-021 -- CI should configure acceptance tests to run serially (`--runInBand`) to resolve intermittent session store timeouts.

---

## Cycle 2 Demo

**Demo scenario:** User logs in. Searches notes by keyword -- sees title and body matches ranked by relevance with highlighted snippets. Creates folders and organizes notes into them. Exports a note as a Markdown file. Uses keyboard shortcuts to create a note (Cmd+N), bold text (Cmd+B), and trigger search (Cmd+K). Views the workspace on a tablet-width viewport with sidebar hamburger toggle. Views on mobile with tab bar navigation. Requests a password reset, receives email link, sets new password, logs in with new credentials. Rate limiting blocks excessive login attempts (HTTP 429). Deletes their account and cannot log back in.

**Demo milestone:** All Must Have requirements for the MVP release are satisfied. The application is feature-complete for MVP pending production deployment (Cycle 3).

---

## Release Map

### MVP (Release 1) -- Confidence: Firm

**Release criterion:** A user can register, log in, create and edit Markdown notes with live preview and auto-save, browse their catalog, search their notes by keyword, view and restore version history, and reset a forgotten password. Public landing page attracts new users. All data is isolated per user. Auth endpoints are rate-limited. Deployed to production on nxlabs.cc.

**Scope:** All Must Have requirements (REQ-001 through REQ-008, REQ-010 through REQ-012, REQ-015 through REQ-017)

**Cycle mapping:**
- Cycle 1 (COMPLETE): Walking skeleton -- registration, login, workspace, CRUD, editor, auto-save, versioning, landing page
- Cycle 2 (THIS CYCLE): Search (REQ-010), password reset (REQ-003), rate limiting (SEC-001)
- Cycle 3: Production deployment (DevOps Phase 3, monitoring)

**Explicitly excluded from MVP:**
- REQ-009 (Folders) -- Should Have; ships in Cycle 2 alongside MVP features but classified as Release 2 value
- REQ-013 (Responsive design) -- Should Have; ships in Cycle 2 but classified as Release 2 value
- REQ-014 (Account deletion) -- Should Have; ships in Cycle 2 but classified as Release 2 value
- Keyboard shortcuts (TASK-025) -- No approved requirement; ships in Cycle 2 as bonus
- Export notes (TASK-026) -- No approved requirement; ships in Cycle 2 as bonus

**Note on Cycle 2 vs. MVP scope:** Cycle 2 delivers both the remaining MVP Must Have features (search, password reset, rate limiting) and several Release 2 Should Have features (folders, responsive, account deletion) plus two new features (shortcuts, export). All ship together in the same codebase, but the MVP release criterion is met when the Must Have requirements are satisfied. The Should Have and new features are bonus value that ships alongside the MVP.

### Release 2 -- Confidence: Planned

**Business value:** Organizational features, broader device support, data portability, and productivity tools.

**Scope (all shipping in Cycle 2 alongside MVP Must Haves):**
- REQ-009 (Folders)
- REQ-013 (Responsive design)
- REQ-014 (Account deletion)
- Keyboard shortcuts (pending requirement approval)
- Export notes (pending requirement approval)

### Release 3 (Production) -- Confidence: Firm

**Business value:** Production-grade deployment with monitoring, health checks, and rollback capability.

**Scope:**
- TASK-022: DevOps Phase 3 -- production environment
- TASK-023: Production monitoring and fitness function instrumentation (prod-side)

### Unplaced Requirements

None from requirements-v2.md. All 17 requirements are placed.

Two features requested by the Nexus (keyboard shortcuts, export notes) are not yet formalized as requirements. The Planner recommends the Analyst produce REQ-018 and REQ-019 before the Builder begins TASK-025 and TASK-026.

---

## Cut Line

```
-- CYCLE 2 P1 -------- Rate limiting, search, password reset (Must Have + security)
-- CYCLE 2 P2 -------- Folders, DevOps Phase 2, responsive, shortcuts, export, account deletion, FF instrumentation
-- CYCLE 3 (P3) ------ Production environment, monitoring
-- CUT LINE --------------------------------------------------------
-- No tasks below the cut line.
-- TASK-019 (account deletion) was promoted from DEFERRED to Cycle 2 P2
   per Nexus decision at Cycle 1 Demo Sign-off.
```

**Cut candidates within Cycle 2 (if scope pressure arises):**

| Task | What is lost if cut | Cost to include |
|---|---|---|
| TASK-025 (Keyboard shortcuts) | Productivity feature for power users. No approved requirement. | 1 Builder session. Low risk. |
| TASK-026 (Export notes) | Data portability. No approved requirement. | 1 Builder session. Low risk. |
| TASK-019 (Account deletion) | Users cannot self-service delete accounts. Manual DB intervention required. | 1 Builder session. Low risk. |
| TASK-020 (FF instrumentation) | Fitness functions not comprehensively automated in CI. Many already covered by task-level acceptance tests. | 1 Builder session. Low risk. |

If the Nexus needs to reduce Cycle 2 scope, these four tasks are the candidates in the order listed. Cutting all four saves 4 Builder sessions without affecting any Must Have requirement.

---

## Observations Carried Forward

| ID | Description | Action in Cycle 2 |
|---|---|---|
| OBS-V004-05 | Acceptance tests intermittent timeouts in parallel Jest against live session store | Route to DevOps during TASK-021: configure CI to run acceptance tests with `--runInBand` |
| OBS-V008-02 | getNotes() failure silently falls back to empty state with no error indicator | Address if touched during TASK-017 (folder integration with sidebar) |
| OBS-V007-02 | prose-preview Tailwind class used but not defined in tailwind.config.js | Address during TASK-018 (responsive design touches Tailwind config) |

---

## Summary

| Metric | Count |
|---|---|
| Total tasks (Cycle 2) | 10 |
| P1 tasks | 3 (TASK-024, TASK-014, TASK-015) |
| P2 tasks | 7 (TASK-017, TASK-021, TASK-018, TASK-025, TASK-026, TASK-019, TASK-020) |
| Must Have requirements addressed | 2 (REQ-010, REQ-003) + 1 security (SEC-001) |
| Should Have requirements addressed | 3 (REQ-009, REQ-013, REQ-014) |
| New features (no requirement) | 2 (TASK-025, TASK-026) -- flagged to Nexus |
| Cut candidates | 4 (TASK-025, TASK-026, TASK-019, TASK-020) |
| Spikes | 0 |
| Scaffolder invocation | Yes (9 Builder tasks >= 3 threshold) |
| Walking skeleton | Achieved in Cycle 1 |
| MVP feature-complete after Cycle 2 | Yes (all Must Have requirements satisfied) |

---

## Handoff Notes

**For the Orchestrator:**
- The top of the plan is TASK-024 (rate limiting) because it is a deferred security finding (SEC-001, High severity) with zero risk and immediate value. It should be the quickest win in the cycle.
- TASK-014 (search) and TASK-015 (password reset) are the two remaining Must Have features. They complete the MVP feature set.
- TASK-020 (fitness instrumentation) must follow TASK-014 because search FF tests require the search feature.
- TASK-025 and TASK-026 are not traced to approved requirements. Flag to Nexus at Plan Gate: recommend the Analyst produce requirements before Builder execution, or the Nexus accepts the traceability gap.
- OBS-V004-05 should be routed to DevOps during TASK-021.
- Scaffolder should be invoked before the first Builder task in Cycle 2 (9 tasks >= 3 threshold).

**For the Nexus at Plan Gate:**
- Cycle 2 completes all Must Have requirements. After this cycle, the application is feature-complete for MVP. Only production deployment (Cycle 3) remains.
- Two tasks (TASK-025 keyboard shortcuts, TASK-026 export notes) are included at the Nexus's request but lack approved requirements. The Nexus should decide: (a) accept the traceability gap, or (b) route to the Analyst for requirement creation before Builder execution.
- Four tasks are cut candidates if scope pressure arises. Cutting them does not affect any Must Have requirement.
- TASK-019 (account deletion) was promoted from DEFERRED per Nexus indication at Cycle 1 Demo Sign-off. Confirm this is still desired.
