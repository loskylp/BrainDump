# Project State
**Manifest version:** v1 | **Profile:** Commercial
**Current phase:** CYCLE 2 PLANNING
**Current cycle:** 2
**Last updated:** 2026-03-21

---

## Where We Are

Cycle 1 is fully closed. All 14 tasks verified PASS. CI green. Staging deployed. Demo signed off by the Nexus on 2026-03-21. Playwright demo screenshots (12 screenshots across 5 tasks) committed to version control under `tests/demo/TASK-XXX/`. Sentinel cycle-level security review complete -- SEC-003 resolved, SEC-001 deferred to Cycle 2 as TASK-024.

The Methodologist retrospective question is pending: "Is there anything you want to change for the next iteration?" Once answered, proceed to Cycle 2 planning via the Planner.

**CI INCIDENT (2026-03-21, RESOLVED):** All CI jobs failing, staging unreachable. Four root causes identified and fixed (see ESC-002 in escalation log). CI pipeline restored.

## Active Work

**Agent in control:** Orchestrator (transition to Cycle 2)
**Current task:** Methodologist retrospective question, then Cycle 2 planning
**Iteration:** --
**Waiting for:** Methodologist response to retrospective question

---

## Cycle 1 -- Task Status

| Task | Status | Iterations | Verifier |
|---|---|---|---|
| TASK-001: DevOps Phase 1 -- CI pipeline and dev environment | COMPLETE | -- | -- (DevOps, not Builder) |
| TASK-016: Workspace layout shell and routing | COMPLETE | 2 of 3 | PASS (6/6, 43 tests) |
| TASK-002: Database schema, migrations, and RLS role separation | COMPLETE | 1 of 3 | PASS (10/10, 140 tests) |
| TASK-003: User registration | COMPLETE | 2 of 3 | PASS (6/6 AC, 295 tests) |
| TASK-004: User login and logout | COMPLETE | 2 of 3 | PASS (6/6 AC, 268 tests) |
| TASK-005: Ownership guard middleware and data isolation | COMPLETE | 2 of 3 | PASS (7/7 AC, 335 tests) |
| TASK-006: Create a note with persistence | COMPLETE | 1 of 3 | PASS (6/6 AC, 419 tests) |
| TASK-008: Note catalog sidebar | COMPLETE | 2 of 3 | PASS (5/5 AC, 30 Verifier tests, 216 unit tests) |
| TASK-011: Public landing page | COMPLETE | 1 of 3 | PASS (6/6 AC, 549 tests) |
| TASK-007: Split-pane Markdown editor with live preview | COMPLETE | 1 of 3 | PASS (8/8 AC, 626 tests) |
| TASK-009: Edit a note (API and editor integration) | COMPLETE | 1 of 3 | PASS (5/5 AC, 480 tests) |
| TASK-010: Delete a note | COMPLETE | 1 of 3 | PASS (6/6 AC, 397 unit tests) |
| TASK-012: Auto-save with debounce | COMPLETE | 1 of 3 | PASS (7/7 AC, 407 unit tests) |
| TASK-013: Note version history | COMPLETE | 1 of 3 | PASS (10/10 AC, 448 unit tests) |

**Cycle summary:**
- Tasks complete: 14 of 14 (all Cycle 1 tasks)
- Tasks in progress: 0
- Requirements satisfied this cycle: REQ-001 (registration), REQ-002 (login/logout), REQ-011 (data isolation), REQ-004 (create note), REQ-012 (timestamps), REQ-008 (note catalog), REQ-017 (landing page), REQ-007 (Markdown editor with live preview), REQ-005 (edit note), REQ-006 (delete note), REQ-015 (auto-save), REQ-016 (version history)
- Sentinel: COMPLETE -- cycle-level security review done; SEC-001 (High) deferred to Cycle 2 as TASK-024; SEC-003 (High) resolved

---

## Nexus Gate Log

| Gate | Date | Decision | Notes |
|---|---|---|---|
| Requirements Gate | 2026-03-19 | APPROVED | 17 requirements (12 Must Have, 5 Should Have). Auditor: PASS WITH DEFERRALS. |
| Architecture Gate | 2026-03-19 | APPROVED | 9 ADRs, 55 fitness functions, 17/17 covered. Auditor: PASS. |
| Plan Gate | 2026-03-19 | APPROVED | 23 tasks across 3 cycles. Cycle 1: 14 tasks (walking skeleton). Cut line: TASK-019 (account deletion) deferred. |
| Demo Sign-off -- Cycle 1 | 2026-03-21 | ACCEPTED | 14/14 tasks PASS, 448 tests, Sentinel clear. 12 Playwright screenshots reviewed and committed. |
| Go-Live -- v1.0.0 | -- | -- | |

---

## Pending Decisions

None. Cycle 1 Demo Sign-off accepted. Next decision point: Methodologist retrospective, then Plan Gate for Cycle 2.

---

## Cycle 2 -- Deferred Security Tasks

| Task | Source | Severity | Description | Status |
|---|---|---|---|---|
| TASK-024 | SEC-001 (Sentinel Cycle 1) | High | Install `express-rate-limit`, apply to `POST /api/auth/login` and `POST /api/auth/register` with 10 req/15min per IP limit | Pending -- Cycle 2 |

---

## Iterate Loop State

**Task:** Cycle 1 closed
**Iteration:** --
**Failure trend:** N/A
**Convergence check:** N/A
**Next action:** Ask Methodologist retrospective question. On response: route to Planner for Cycle 2 task plan (three-pass sequence: decomposition, scoring, release map).

---

## Process Metrics -- Cycle 1

| Metric | Value |
|---|---|
| Auditor passes -- requirements | 1 (v2, PASS WITH DEFERRALS) |
| Auditor passes -- architecture | 1 (v1, PASS) |
| Gate rejections this cycle | 0 |
| Tasks completed | 14 of 14 planned (all Cycle 1) |
| Average iterations to PASS | 1.3 (TASK-016: 2, TASK-002: 1, TASK-003: 2, TASK-004: 2, TASK-005: 2, TASK-006: 1, TASK-008: 2, TASK-011: 1, TASK-007: 1, TASK-009: 1, TASK-010: 1, TASK-012: 1, TASK-013: 1) |
| Tasks that hit max iterations | 0 |
| Escalations to Nexus | 0 |
| Escalations resolved internally | 1 (ESC-001: stale TASK-005 Verifier test -- RESOLVED) |
| Backward cascade triggered | No |

---

## End-of-Cycle Demo Validation Process

At the end of every cycle, before Demo Sign-off can be granted:
1. Playwright demo scripts (one per task with visual/interactive output) must be run against the staging environment
2. Screenshots are saved under `tests/demo/TASK-XXX/` (directory name matches the task ID from the demo script)
3. Screenshot filenames correspond to the numbered scenario in the demo script (e.g., `01-landing-page-unauthenticated.png`)
4. All screenshots are committed to version control in a dedicated commit referencing the cycle demo sign-off
5. The Nexus reviews the screenshots against the demo script scenarios before granting sign-off
6. Demo Sign-off Briefing must reference the screenshot commit hash

This process was codified after Cycle 1 demo validation on 2026-03-21.

---

## Standing Routing Rules (Cycle 1 -- CLOSED)

- Scaffolder runs before first Builder task (14 tasks >= 3 threshold). DONE.
- Builder execution order (sequential): TASK-016 (DONE), TASK-002 (DONE), TASK-003 (DONE), TASK-004 (DONE), TASK-005 (DONE), TASK-006 (DONE), TASK-008 (DONE), TASK-011 (DONE), TASK-007 (DONE), TASK-009, TASK-010, TASK-012, TASK-013.
- TASK-012 (auto-save) and TASK-013 (versioning) must be sequential.
- OBS-002: Migration role RLS bypass -- resolved by separating RLS into its own migration (20260319000006). DDL is not subject to RLS; test/seed scripts must SET LOCAL before DML.
- OBS-V004-05: Acceptance tests exhibit intermittent timeouts when Jest runs in parallel against the live session store. Pass cleanly under --runInBand. DevOps should configure CI to run acceptance tests serially. (Action: route to DevOps when next DevOps task is dispatched, or note for TASK-021.)
- ESC-001: RESOLVED. Stale TASK-005 Verifier test (`toBe(500)` on `GET /api/notes/:id`) updated to `toBe(200)` during TASK-011 verification.
- After all Cycle 1 tasks pass Verifier, route to Sentinel. DONE.
- SEC-001 (no rate limiting on auth endpoints) deferred to Cycle 2 as TASK-024. Dependencies satisfied (TASK-004 complete). Schedule early in Cycle 2.
- DevOps Phase 2 (staging) triggers after first Builder task passes Verifier. TASK-016 passed -- eligible.

---

## Observations Log

| ID | Source | Description | Status |
|---|---|---|---|
| OBS-002 | Auditor | Migration role RLS bypass | Resolved (TASK-002) |
| OBS-V004-05 | Verifier (TASK-004) | Acceptance tests intermittent timeouts in parallel Jest against live session store; pass under --runInBand | Open -- route to DevOps (CI config) |
| OBS-V008-01 | Verifier (TASK-008) | WorkspaceLayout uses inline style for grid instead of Tailwind classes; inconsistent with Tailwind-first approach but not prohibited by ADR-008 | Open -- informational |
| OBS-V008-02 | Verifier (TASK-008) | getNotes() failure silently falls back to empty state with no error indicator; acceptable for TASK-008 scope | Open -- track for UX task |
| OBS-V008-03 | Verifier (TASK-008) | Notes with empty title render as "Untitled" in NoteItem; defensive and consistent with domain model | Closed -- by design |
| OBS-V011-01 | Verifier (TASK-011) | Stale comments in App.test.jsx describe LandingPage as returning null (old stub) -- tests pass correctly | Open -- informational |
| OBS-V011-02 | Verifier (TASK-011) | rounded class on features section produces 4px radius, within ADR-008 spec | Closed -- within spec |
| OBS-V011-03 | Verifier (TASK-011) | No meta description tag -- noted for future SEO work | Open -- informational |
| OBS-V007-01 | Verifier (TASK-007) | TASK-003 registration verifier occasionally fails under full parallel suite run due to DB state contention -- pre-existing (same as OBS-V004-05) | Open -- pre-existing |
| OBS-V007-02 | Verifier (TASK-007) | prose-preview Tailwind class used in Preview but not defined in tailwind.config.js -- harmless, should be defined or removed | Open -- informational |
| OBS-V007-03 | Verifier (TASK-007) | WorkspaceLayout and Editor both apply bg-bg-editor -- slight redundancy, not a defect | Open -- informational |
| OBS-V007-04 | Verifier (TASK-007) | Monospace font applied via inline style on CM6 instance -- correct approach for CM6 shadow DOM, not an ADR-008 violation | Closed -- not a violation |

---

## Artifact Trail

| Artifact | Location | Version |
|---|---|---|
| Methodology Manifest | `process/methodologist/manifest-v1.md` | v1 |
| Brief (Domain Model) | `process/analyst/brief-v2.md` | v2 |
| Requirements List | `process/analyst/requirements-v2.md` | v2 |
| Audit -- Requirements | `process/auditor/audit-requirements-v2.md` | v2 (PASS WITH DEFERRALS) |
| Architecture Overview | `process/architect/architecture-overview-v1.md` | v1 |
| ADRs | `process/architect/adr/ADR-001` through `ADR-009` | v1 |
| Fitness Functions Index | `process/architect/fitness-functions.md` | v1 |
| Audit -- Architecture | `process/auditor/audit-architecture-v1.md` | v1 (PASS) |
| Task Plan | `process/planner/task-plan-v1.md` | v1 (amended: +TASK-024 for Cycle 2) |
| Environment Contract | `process/devops/environment-contract-v1.md` | v1 |
| Verification Report -- TASK-016 | `process/verifier/verification-report-task-016.md` | Iteration 2 (PASS 6/6) |
| Verification Report -- TASK-002 | `process/verifier/verification-report-task-002.md` | Iteration 1 (PASS 10/10) |
| Verification Report -- TASK-003 | `process/verifier/verification-report-task-003.md` | Iteration 2 (PASS 6/6) |
| Verification Report -- TASK-004 | `process/verifier/verification-report-task-004.md` | Iteration 2 (PASS 6/6) |
| Verification Report -- TASK-005 | `process/verifier/verification-report-task-005.md` | Iteration 2 (PASS 7/7) |
| Verification Report -- TASK-006 | `process/verifier/verification-report-task-006.md` | Iteration 1 (PASS 6/6) |
| Verification Report -- TASK-008 | `process/verifier/verification-reports/TASK-008-verification.md` | Iteration 2 (PASS 5/5) |
| Verification Report -- TASK-011 | `process/verifier/verification-reports/TASK-011-verification.md` | Iteration 1 (PASS 6/6) |
| Verification Report -- TASK-007 | `process/verifier/verification-reports/TASK-007-verification.md` | Iteration 1 (PASS 8/8) |
| Builder Handoff -- TASK-008 | `process/builder/handoff-notes/TASK-008-iter1-handoff.md` | Iteration 1 |
| Security Report -- Cycle 1 | `process/sentinel/security-reports/cycle-1-security.md` | v1 (SEC-001 DEFERRED TO CYCLE 2) |
| Demo Sign-off Briefing -- Cycle 1 | `process/orchestrator/demo-signoff-briefing-cycle-1.md` | v1 |
| Demo Screenshots -- Cycle 1 | `tests/demo/TASK-{003,007,008,009,011}/` | 12 screenshots (commit c849d8b) |

---

## TASK-002 Builder Handoff Note

**What was built:**
- 6 Sequelize migration files creating all 5 tables (users, folders, notes, note_versions, password_reset_tokens), GIN index, search vector trigger, and RLS policies
- 4 Sequelize model files (User, Note, NoteVersion, Folder) with associations in models/index.js
- rlsContext middleware (SET LOCAL app.current_user_id)
- Health check route (GET /api/health) -- was a stub, now implemented
- database.js configuration with CLI-compatible exports
- Jest config and 45 integration tests covering all 10 acceptance criteria

**Deviations:**
- OBS-002 resolved by placing RLS in a separate migration (20260319000006) rather than using BYPASSRLS on the migration role. DDL operations are not subject to RLS, so the migration role works without special privileges. Test/seed scripts that need to INSERT into RLS-protected tables must SET LOCAL app.current_user_id first.
- Note model uses named scope `forUser(userId)` instead of defaultScope, as recommended by Scaffolder (Sequelize defaultScope is static, cannot reference per-request state).
- Health route was implemented (was a TASK-001 stub throwing "Not implemented") since models/index.js now exports a working sequelize instance.

**Limitations:**
- rlsContext SET LOCAL runs outside a transaction context. For full RLS enforcement in request handlers, service functions should wrap operations in sequelize.transaction() and SET LOCAL within that transaction. This will be addressed when service functions are implemented (TASK-006 onwards).

---

## TASK-003 Builder Handoff Notes

**Iteration 1 -- What was built:**
- All TASK-003 implementation was already in place from the Scaffolder -- no new production code written
- Backend: `authService.register()` with bcryptjs cost 12, input validation, duplicate email handling; `POST /api/auth/register` route with session creation; `session.js` with connect-pg-simple (`createTableIfMissing: true`)
- Frontend: `RegisterForm.jsx` with client-side validation (username, email format, password >= 8); `RegisterPage.jsx` with navigation to /workspace on success
- Tests: 18 backend acceptance tests (AC-1 through AC-5) + 16 frontend component tests (AC-6 + integration)

**Iteration 2 -- Verifier-directed fixes:**
- Fix 1: Frontend test infrastructure -- installed `@testing-library/jest-dom`, created `setupTests.js`, added `setupFiles` to `vitest.config.js`. All 58 frontend tests now pass.
- Fix 2: TASK-002 regression -- removed `createTableIfMissing: true` from `session.js`, created migration `20260319000007-create-sessions.js` to manage session table via Sequelize migrations.
- Note: TASK-002 Verifier-added tests (table count, SequelizeMeta count) expect 6 but will now see 7 due to the new session migration. These are Verifier-owned assertions and need updating by the Verifier.

**Limitations (unchanged):**
- Login, logout, forgot-password, reset-password routes remain stubs

---

## TASK-004 Builder Handoff Notes

**What was built (iteration 2 -- PASS):**
- `User.comparePassword()` implemented (was a stub since TASK-002)
- `authService.login()` with email/password validation, session creation
- `authService.logout()` with session destruction in PostgreSQL store
- `POST /api/auth/login` and `POST /api/auth/logout` routes
- `authenticate` middleware for protected route gating
- Frontend: `LoginForm.jsx`, `LoginPage.jsx` with client-side validation
- Session cookie: httpOnly, secure (production), sameSite: strict, 7-day rolling expiry
- 21 Builder acceptance tests + 28 Verifier acceptance tests = full AC coverage

**Test results at PASS:**
- TASK-004 Builder: 21/21
- TASK-004 Verifier: 28/28
- TASK-003 regression: 45/45
- TASK-002 regression: 52/52
- Integration: 40/40
- Frontend: 77/77
- Total: 268/268

**Observation:**
- OBS-V004-05: Acceptance tests exhibit intermittent timeouts when Jest runs in parallel against the live session store. Pass cleanly under --runInBand. DevOps should configure CI to run acceptance tests serially.

---

## TASK-005 Builder Handoff Notes

**What was built (iteration 2 -- PASS):**
- `ownershipGuard` middleware applied to all routes under `/api/notes`, `/api/folders`, `/api/versions`
- For routes with resource ID parameter: middleware loads the resource and verifies `resource.user_id === req.session.userId`; mismatch returns 404 (not 403)
- For list/search routes: query includes `WHERE user_id = req.session.userId`
- Sequelize default scopes on Note, Folder, and NoteVersion models add `WHERE user_id = :currentUserId`
- Unit tests for authenticate and ownershipGuard middleware: 22/22
- RLS validation tests confirm database-level blocking when app-level filter is bypassed

**Test results at PASS:**
- TASK-005 Verifier: 34/34
- TASK-005 Builder: 33/33
- Unit tests (authenticate + ownershipGuard): 22/22
- Regression (TASK-002/003/004 + integration): 169/169
- Frontend: 77/77
- Total: 335/335

---

## TASK-006 Builder Handoff Notes

**What was built (iteration 1 -- PASS):**
- `POST /api/notes` endpoint: creates a note with title, empty body, auto-generated UUID, timestamps
- `noteService.create()` with transaction-scoped RLS (`SET LOCAL app.current_user_id`)
- Frontend: "New Note" button in workspace triggers creation and navigates to editor
- Ownership guard applied; response returns the created note with 201 status
- AC-3 atomicity (FF-D16) verified against live DB -- note creation is atomic within a transaction

**Test results at PASS:**
- TASK-006 unit + acceptance: 84/84
- Backend regression: 258/258
- Frontend: 77/77
- Total: 419/419

**Observations:** None.

---

## TASK-008 Builder Handoff Notes

**What was built (iteration 2 -- PASS):**
- `GET /api/notes` endpoint: returns user's notes sorted by `updated_at DESC`, excluding body for list performance
- `GET /api/notes/:id` endpoint: returns full note (including body) for the owning user; 404 for cross-user/non-existent; 401 for unauthenticated
- `noteService.getNotes(userId)` and `noteService.getNote(noteId, userId)` with `forUser` Sequelize scope
- `Sidebar.jsx` component: props-driven, renders note list with active highlighting (`aria-current="page"`, accent border), empty state, "New note" button, user footer with logout
- `WorkspacePage.jsx` extended: `notes` and `activeNoteId` state, `useEffect` fetch on mount, `activeNoteId` change triggers `getNote()` fetch, note body displayed in editor area
- Frontend API: `getNotes()`, `getNote(noteId)`, `createNote()` implemented

**Test results at PASS:**
- TASK-008 Verifier (backend + frontend): 30/30
- Backend unit: 86/86
- Frontend unit: 130/130
- Backend regression: 250/251 (1 stale test -- ESC-001)
- Total verified: 496 (excluding 1 stale)

**Observations:** OBS-V008-01 (inline grid style), OBS-V008-02 (silent getNotes error fallback), OBS-V008-03 (empty title renders as "Untitled" -- by design).

---

## TASK-011 Builder Handoff Notes

**What was built (iteration 1 -- PASS):**
- Public landing page at root URL for unauthenticated visitors
- App description, feature highlights (Markdown editor, live preview, search, version history), registration CTA
- Login link accessible from landing page
- Unauthenticated access to note URLs redirects to login/landing
- Professional/technical aesthetic per ADR-008 design tokens
- Authenticated users at root URL redirected to workspace

**Test results at PASS:**
- Frontend (Vitest): 166/166
- Backend (Jest + PostgreSQL): 383/383
- Total: 549/549

**ESC-001 resolved:** Stale `toBe(500)` assertion in TASK-005 verifier test updated to `toBe(200)`.

**Observations:** OBS-V011-01 (stale comments in App.test.jsx), OBS-V011-02 (4px border radius within spec), OBS-V011-03 (no meta description tag).

---

## TASK-007 Builder Handoff Notes

**What was built (iteration 1 -- PASS):**
- `Editor.jsx`: CodeMirror 6 via `@uiw/react-codemirror` with `markdown()` extension and `oneDark` theme; monospace font (JetBrains Mono stack) at 14px via inline style (correct for CM6 shadow DOM)
- `Preview.jsx`: markdown-it with `html: false`, `linkify: true`, `typographer: true`; `useMemo` on `md.render(value)` for efficient re-computation; XSS-safe (script tags escaped)
- `WorkspacePage.jsx`: shared `editorBody` state with unthrottled `handleEditorChange` callback wiring Editor to Preview
- Split-pane layout: editor-panel (left, dark bg-bg-editor) and preview-panel (right, light bg-bg-primary) with 1px solid border divider
- CommonMark compliance: ATX headings, emphasis, links, lists, code blocks, inline code, paragraphs
- FF-D02: preview render < 5ms typical, well under 100ms threshold; no debounce in the data path

**Test results at PASS:**
- TASK-007 Builder unit: 30/30
- TASK-007 Verifier acceptance: 47/47
- Frontend (Vitest): 243/243
- Backend (Jest + PostgreSQL): 383/383
- Total: 626/626

**Observations:** OBS-V007-01 (pre-existing DB contention), OBS-V007-02 (prose-preview class undefined), OBS-V007-03 (redundant bg-bg-editor), OBS-V007-04 (inline style on CM6 -- not a violation).

---

## All Nexus Decisions (Complete)

| Decision | Date | Outcome |
|---|---|---|
| Ratify Manifest v1 | 2026-03-19 | Approved |
| Requirements Gate | 2026-03-19 | Approved -- 17 requirements locked (12 Must Have, 5 Should Have) |
| Architecture Gate | 2026-03-19 | Approved -- 9 ADRs, 55 fitness functions, full requirements coverage, AUDIT-003 resolved |
| Plan Gate | 2026-03-19 | Approved -- 23 tasks, 3 cycles, 1 deferred (TASK-019 account deletion) |
| Demo Sign-off -- Cycle 1 | 2026-03-21 | Accepted -- 14/14 tasks, 12 screenshots reviewed, demo validation process codified |
