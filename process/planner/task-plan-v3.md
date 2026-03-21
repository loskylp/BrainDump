# Task Plan -- BrainDump
**Version:** 3 | **Date:** 2026-03-21 | **Artifact Weight:** Draft
**Requirements version:** 4 | **Architecture version:** 1 (+ ADR-010, ADR-011)
**Plan scope:** Cycle 3

---

## Changelog
- v1: Initial task plan from 17 requirements (68 acceptance scenarios) -- 2026-03-19
- v2: Cycle 2 task plan. 10 tasks covering search, password reset, folders, responsive design, keyboard shortcuts, export, rate limiting, DevOps Phase 2, fitness instrumentation, and account deletion. -- 2026-03-21
- v3: Cycle 3 task plan. Three new features from stakeholder demo (REQ-020 ZIP export, REQ-021 tagging, REQ-022 reading mode) plus DevOps Phase 3 (production deployment). 7 tasks total. -- 2026-03-21

---

## Cycle 1 -- Summary (CLOSED)

All 14 Cycle 1 tasks verified PASS. Walking skeleton delivered. Demo signed off 2026-03-21.

## Cycle 2 -- Summary (CLOSED)

All 10 Cycle 2 tasks verified PASS. MVP feature-complete. Demo signed off 2026-03-21. Staging live at https://braindump.staging.nxlabs.cc.

---

## Cycle 3 -- Task Decomposition

### Legend

- **Status:** Pending | In Progress | Complete
- **Dependency notation:** `>>` means "must complete before"
- **Cycle 1 and Cycle 2 dependencies are satisfied:** All prior tasks are COMPLETE

---

### TASK-027: Tagging backend -- schema, model, API
**Requirement(s):** REQ-021
**ADR(s):** ADR-010, ADR-003
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** New schema tables (tags, note_tags), search vector trigger modification, many-to-many Sequelize associations. Known patterns but the search vector trigger update adds complexity (Medium).
**Value justification:** Tagging is the most complex new feature with backend schema changes, API endpoints, and search integration. Frontend tasks depend on this. Must be built first (High).
**Dependencies:** TASK-002 >> TASK-027 (satisfied), TASK-014 >> TASK-027 (satisfied -- search vector integration)
**Status:** Pending
**Acceptance Criteria:**
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

---

### TASK-028: Tagging frontend -- UI integration
**Requirement(s):** REQ-021
**ADR(s):** ADR-010, ADR-008
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard React component work -- tag badges, filter UI, tag input. No architectural unknowns (Low).
**Value justification:** Completes the tagging feature for users. Backend is useless without frontend integration (High).
**Dependencies:** TASK-027 >> TASK-028
**Status:** Pending
**Acceptance Criteria:**
1. Tag badges appear on note entries in the catalog sidebar (small colored labels below the note title)
2. A tag filter section is visible in the sidebar (above the note list) showing all user tags as clickable badges
3. Clicking a tag badge in the filter section toggles its filter state; active filters are visually distinguished (e.g., highlighted background)
4. When one or more tag filters are active, only notes matching ANY selected tag are displayed in the catalog (OR logic)
5. A "clear filters" action removes all active tag filters and restores the full note list
6. An "Add tag" input in the editor toolbar or note detail area allows the user to type a tag name and press Enter to add it; inline creation (if the tag does not exist, it is created)
7. Tag input provides autocomplete from existing user tags
8. A tag on a note can be removed by clicking an "x" on the tag badge in the editor/note detail view
9. Tag validation feedback: names > 50 chars, names with spaces, or invalid characters show a clear error message
10. Tags in search results are displayed alongside the result entry (consistent with catalog sidebar display)

---

### TASK-029: Bulk export to ZIP
**Requirement(s):** REQ-020
**ADR(s):** ADR-011
**Priority Group:** P1 | **Risk:** Low | **Value:** Medium
**Risk justification:** Single backend endpoint + npm package (archiver). Streaming ZIP generation is a well-documented pattern. No unknowns (Low).
**Value justification:** Data portability feature requested by stakeholders. Extends existing single-note export (REQ-019). Straightforward implementation (Medium).
**Dependencies:** TASK-017 >> TASK-029 (satisfied -- folders must exist for folder structure in ZIP)
**Status:** Pending
**Acceptance Criteria:**
1. `GET /api/notes/export` returns a ZIP file with Content-Type `application/zip` and Content-Disposition header with filename `braindump-export-{username}-{YYYY-MM-DD}.zip`
2. The ZIP contains one `.md` file per note owned by the authenticated user (complete collection)
3. Notes in folders are placed in subdirectories matching the folder name (sanitized); root-level notes at ZIP root
4. Each `.md` file contains the note's raw Markdown body (current content only, no version history)
5. Filenames are derived from note titles, sanitized for filesystem safety (same rules as REQ-019)
6. Filename collisions within the same directory are resolved with numeric suffix (e.g., `my-note.md`, `my-note-2.md`)
7. An "Export All" button is visible in the sidebar header; disabled with tooltip when note count is 0
8. Clicking "Export All" triggers a browser download of the ZIP file
9. Per-user isolation: export endpoint returns only the authenticated user's notes
10. Exporting with 0 notes returns an empty valid ZIP (or button is disabled -- pick one; prefer disabled)

---

### TASK-030: Reading mode
**Requirement(s):** REQ-022
**ADR(s):** ADR-008
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Frontend-only feature. Reuses existing markdown-it renderer. No backend changes. Standard React state management (Low).
**Value justification:** UX enhancement requested by stakeholders. Distraction-free reading experience (Medium).
**Dependencies:** TASK-007 >> TASK-030 (satisfied -- editor/preview must exist), TASK-025 >> TASK-030 (satisfied -- keyboard shortcuts hook for Cmd/Ctrl+Shift+R)
**Status:** Pending
**Acceptance Criteria:**
1. A "Reading Mode" button is visible in the editor toolbar (alongside Save, History, Delete, Export)
2. Clicking the button replaces the split-pane editor with a full-width rendered Markdown view (centered, max-width ~720px, generous line spacing)
3. The sidebar is hidden in reading mode
4. The toolbar is minimized to: exit button, note title, previous/next note navigation controls
5. `Cmd/Ctrl+Shift+R` toggles reading mode on/off (integrated with `useKeyboardShortcuts` hook from TASK-025)
6. `Escape` exits reading mode and restores the full workspace with the same note active
7. Previous/next note navigation (by last-modified catalog order) works within reading mode without returning to workspace
8. Navigation controls are disabled at the boundary (first note: no previous; last note: no next)
9. The rendered content uses the same markdown-it renderer as the preview panel (REQ-007) -- identical output
10. The reading view reflects the professional/technical design aesthetic (ADR-008 design tokens)
11. Reading mode is behind authentication (unauthenticated access redirected to login)

---

### TASK-031: DevOps Phase 3 -- production environment
**Requirement(s):** REQ-012, Manifest CD philosophy
**ADR(s):** ADR-007
**Priority Group:** P2 | **Risk:** Medium | **Value:** High
**Risk justification:** Production deployment on nxlabs.cc infrastructure. First production environment for this service. Requires Traefik configuration, production database provisioning, environment secrets management (Medium).
**Value justification:** Required for Go-Live. Without production environment, the application cannot serve real users (High).
**Dependencies:** TASK-021 >> TASK-031 (satisfied -- staging CD pipeline must exist)
**DevOps Phase:** 3
**Status:** Pending
**Acceptance Criteria:**
1. Docker Compose file for production at `/opt/braindump/docker-compose.production.yml`
2. Production database provisioned via `provision.sh braindump-production` on nxlabs.cc
3. Production `.env.production` configured with production database URL, session secret (unique), and email provider configuration
4. Container joins `traefik` and `postgres` external Docker networks
5. Traefik routes `braindump.nxlabs.cc` to the production container via Docker labels
6. Watchtower picks up new `:latest` (or `:production`) images and performs rolling restart
7. Uptime Kuma auto-registers via Docker labels and monitors health endpoint
8. Migrations run on container startup before the application server starts
9. Health endpoint returns 200 at `https://braindump.nxlabs.cc/api/health`
10. Rollback procedure documented: pin to a previous image tag, Watchtower picks up the change

---

### TASK-032: Production monitoring and fitness functions (prod-side)
**Requirement(s):** Cross-cutting (prod-side fitness functions)
**ADR(s):** ADR-001 through ADR-011
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Configuring monitoring for an already-deployed service. Known patterns (Low).
**Value justification:** Production observability. Fitness functions verify the system meets its quality attributes in production (Medium).
**Dependencies:** TASK-031 >> TASK-032
**Status:** Pending
**Acceptance Criteria:**
1. Uptime Kuma monitors production health endpoint with alerting configured
2. Application-level logging captures: auth failures, search query latency, export request frequency
3. Node.js process monitoring: memory usage, event loop lag, uncaught exceptions
4. Database connection pool monitoring: active connections, idle connections, wait time
5. Prod-side fitness function checks documented in a runbook (manual verification procedures for FF-P items)
6. Error rate monitoring: 5xx responses tracked, alert on > 1% error rate over 5-minute window

---

### TASK-033: Sentinel cycle-level security review
**Requirement(s):** Cross-cutting (security)
**ADR(s):** All
**Priority Group:** P3 (after all feature tasks pass Verifier) | **Risk:** N/A | **Value:** N/A
**Dependencies:** TASK-027 through TASK-030 must be VERIFIED PASS
**Status:** Pending
**Note:** This is a Sentinel task, not a Builder task. Dispatched after all Cycle 3 feature tasks pass Verifier. The security review covers all new code: tagging API endpoints, bulk export endpoint, reading mode. Focus areas: tag input sanitization (XSS), bulk export authorization, search vector injection via tag names.
**Acceptance Criteria:**
1. No Critical or High severity findings unresolved
2. Tag input sanitization verified (no XSS via tag names)
3. Bulk export endpoint authorization verified (per-user isolation)
4. Reading mode does not expose note content to unauthenticated users
5. Dependency audit: new npm packages (archiver or equivalent) checked for known vulnerabilities

---

## Scoring Summary and Priority Matrix

### Scoring Table

| Task | Risk | Value | Priority | Justification Summary |
|---|---|---|---|---|
| TASK-027 | Medium | High | P1 | Schema foundation for tagging. All tag features depend on this. |
| TASK-028 | Low | High | P1 | Completes tagging UX. Depends on TASK-027. |
| TASK-029 | Low | Medium | P1 | Stakeholder-requested data portability. Independent. |
| TASK-030 | Low | Medium | P2 | UX enhancement. Frontend-only. Independent. |
| TASK-031 | Medium | High | P2 | Production deployment. Required for Go-Live. DevOps agent. |
| TASK-032 | Low | Medium | P2 | Production monitoring. Depends on TASK-031. |
| TASK-033 | N/A | N/A | P3 | Security review. After all feature tasks verified. |

### Priority Matrix Visualization

```
              |  HIGH VALUE          |  MEDIUM VALUE         |  LOW VALUE
--------------+----------------------+-----------------------+-----------------
MEDIUM RISK   |  P1: TASK-027        |                       |
              |  P2: TASK-031        |                       |
--------------+----------------------+-----------------------+-----------------
LOW RISK      |  P1: TASK-028        |  P1: TASK-029         |
              |                      |  P2: TASK-030         |
              |                      |  P2: TASK-032         |
```

---

## Cycle 3 Execution Order

### P1 -- Do first

```
1. TASK-027  Tagging backend (Medium Risk, High Value -- schema foundation)
2. TASK-028  Tagging frontend (Low Risk, High Value -- depends on TASK-027)
3. TASK-029  Bulk export to ZIP (Low Risk, Medium Value -- independent)
```

### P2 -- After P1

```
4. TASK-030  Reading mode (Low Risk, Medium Value -- frontend-only)
5. TASK-031  DevOps Phase 3 -- production (Medium Risk, High Value -- DevOps agent)
6. TASK-032  Production monitoring (Low Risk, Medium Value -- depends on TASK-031)
```

### P3 -- After all feature tasks verified

```
7. TASK-033  Sentinel security review (after TASK-027 through TASK-030 verified)
```

### Dependency Graph

```
TASK-027 (tagging backend)       >> TASK-028 (tagging frontend)
TASK-029 (bulk export)           -- no Cycle 3 dependencies
TASK-030 (reading mode)          -- no Cycle 3 dependencies
TASK-031 (DevOps Phase 3)        -- no Cycle 3 dependencies (Cycle 2 deps satisfied)
TASK-032 (production monitoring) -- TASK-031 >> TASK-032
TASK-033 (security review)       -- TASK-027..TASK-030 >> TASK-033
```

### Linear Execution Order for Builder

```
1. TASK-027  Tagging backend
2. TASK-028  Tagging frontend
3. TASK-029  Bulk export to ZIP
4. TASK-030  Reading mode
5. TASK-031  DevOps Phase 3 (DevOps agent, not Builder)
6. TASK-032  Production monitoring (DevOps agent, not Builder)
7. TASK-033  Sentinel security review (Sentinel agent, not Builder)
```

**Scaffolder invocation:** Cycle 3 has 4 Builder tasks (TASK-027 through TASK-030) >= 3 threshold, so the Scaffolder is invoked before the first Builder task.

---

## Cycle 3 Demo

**Demo scenario:** User logs in. Creates tags ("research", "draft", "important") and assigns them to notes. Filters the catalog sidebar by the "research" tag -- only tagged notes are visible. Clears the filter. Exports all notes as a ZIP -- the downloaded archive contains .md files organized in folder subdirectories. Opens a note and switches to Reading Mode -- clean, centered Markdown rendering with no editor chrome. Navigates to the next note within Reading Mode using the navigation controls. Presses Cmd+Shift+R to toggle back to the workspace. Views the production environment at braindump.nxlabs.cc.

**Demo milestone:** All features from stakeholder demo are delivered. Production environment is live. Application is ready for Go-Live.

---

## Release Map

### MVP (Release 1) -- Confidence: Delivered

All Must Have requirements satisfied in Cycles 1 and 2. Application is feature-complete for MVP.

### Release 2 (Features) -- Confidence: Delivered

All Should Have features from Cycles 1 and 2 delivered (folders, responsive design, account deletion, keyboard shortcuts, single-note export).

### Release 3 (Stakeholder Features + Production) -- Confidence: Firm (THIS CYCLE)

**Business value:** Stakeholder-requested features (tagging, bulk export, reading mode) plus production deployment with monitoring.

**Scope:**
- REQ-020 (ZIP export) -- TASK-029
- REQ-021 (Tagging) -- TASK-027, TASK-028
- REQ-022 (Reading mode) -- TASK-030
- DevOps Phase 3 -- TASK-031, TASK-032

**Release criterion:** User can tag notes, filter by tag, export all notes as ZIP, and read notes in distraction-free mode. Production environment is live at braindump.nxlabs.cc with monitoring.

### Unplaced Requirements

None. All 22 requirements are placed.

---

## Cut Line

```
-- CYCLE 3 P1 -------- Tagging backend, Tagging frontend, Bulk export
-- CYCLE 3 P2 -------- Reading mode, DevOps Phase 3, Production monitoring
-- CYCLE 3 P3 -------- Sentinel security review
-- CUT LINE --------------------------------------------------------
-- No tasks below the cut line.
```

**Cut candidates within Cycle 3 (if scope pressure arises):**

| Task | What is lost if cut | Cost to include |
|---|---|---|
| TASK-030 (Reading mode) | UX enhancement. Core editing/viewing still works. | 1 Builder session. Low risk. |
| TASK-032 (Production monitoring) | Production runs without application-level monitoring. Health check still works via Uptime Kuma. | 1 DevOps session. Low risk. |

If the Nexus needs to reduce Cycle 3 scope, these two tasks are the candidates. Cutting them does not affect any Must Have requirement or production deployment capability.

---

## Summary

| Metric | Count |
|---|---|
| Total tasks (Cycle 3) | 7 |
| P1 tasks | 3 (TASK-027, TASK-028, TASK-029) |
| P2 tasks | 3 (TASK-030, TASK-031, TASK-032) |
| P3 tasks | 1 (TASK-033 Sentinel review) |
| Builder tasks | 4 (TASK-027 through TASK-030) |
| DevOps tasks | 2 (TASK-031, TASK-032) |
| Sentinel tasks | 1 (TASK-033) |
| Requirements addressed | 3 (REQ-020, REQ-021, REQ-022) |
| Scaffolder invocation | Yes (4 Builder tasks >= 3 threshold) |
| Go-Live ready after Cycle 3 | Yes |

---

## Handoff Notes

**For the Orchestrator:**
- TASK-027 (tagging backend) is the foundation -- TASK-028 depends on it. Build TASK-027 first.
- TASK-029 (bulk export) and TASK-030 (reading mode) are independent of each other and of tagging. They can be built in any order after TASK-027/028 or in parallel.
- TASK-031 and TASK-032 are DevOps agent tasks, not Builder tasks.
- TASK-033 is a Sentinel task dispatched after all feature Builder tasks (TASK-027 through TASK-030) are VERIFIED PASS.
- Scaffolder should be invoked before the first Builder task (4 tasks >= 3 threshold).
- After TASK-033 (Sentinel) completes, prepare Demo Sign-off Briefing with Playwright demo validation per Manifest Rule 3.
- After Demo Sign-off, if Nexus approves Go-Live, dispatch TASK-031 and TASK-032, then Go-Live Briefing.

**For the Nexus at Plan Gate:**
- Cycle 3 delivers the three stakeholder-requested features plus production deployment.
- Two tasks are cut candidates (reading mode, production monitoring) if scope pressure arises.
- After this cycle, the application is production-ready with all 22 requirements addressed.
