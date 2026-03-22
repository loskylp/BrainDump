# Task Plan -- BrainDump
**Version:** 1 | **Date:** 2026-03-19 | **Artifact Weight:** Draft
**Requirements version:** 2 | **Architecture version:** 1

---

## Changelog
- v1: Initial task plan from 17 requirements (68 acceptance scenarios) -- 2026-03-19

---

## Pass 1: Decomposition

### Legend

- **Status:** Pending | In Progress | Complete
- **Dependency notation:** `>>` means "must complete before"
- **Fitness function tags:** [FF-Dnn] / [FF-Pnn] reference the fitness functions index

---

### TASK-001: DevOps Phase 1 -- CI pipeline and development environment
**Requirement(s):** REQ-012, Manifest Infrastructure Preconditions
**ADR(s):** ADR-001, ADR-007
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** Known technology (GitHub Actions, Docker), but first integration with nxlabs.cc infrastructure patterns. Uses known tech in a new combination (Medium).
**Value justification:** Precondition for all Builder tasks. On the critical path of the walking skeleton. Unblocks every other task (High).
**Dependencies:** None (first task)
**DevOps Phase:** 1
**Acceptance Criteria:**
1. GitHub Actions workflow runs lint, unit tests, and integration tests on every push to main
2. Integration tests run against a PostgreSQL 16 service container in CI
3. Migration test step: apply all migrations to a fresh database, then run the full test suite
4. Docker image builds successfully in CI
5. On CI green, image is pushed to ghcr.io with `:staging` tag
6. Health check endpoint (`GET /api/health`) returns 200 with `{ status: "ok", db: "connected" }` when the app can reach PostgreSQL
7. Docker entrypoint script runs `sequelize db:migrate` before `node server.js`
8. Development environment documented: local setup instructions, environment variables, how to run tests
**Fitness Functions:** FF-D01, FF-D02, FF-D11, FF-D32, FF-D33, FF-D34, FF-D43

---

### TASK-002: Database schema, migrations, and RLS role separation
**Requirement(s):** REQ-012, REQ-011, OBS-002
**ADR(s):** ADR-003, ADR-006
**Priority Group:** P1 | **Risk:** High | **Value:** High
**Risk justification:** One-way door (schema is the foundation). RLS with FORCE ROW LEVEL SECURITY + migration role bypass is a pattern the team has not used before. OBS-002 explicitly flags this as requiring attention (High).
**Value justification:** Foundation for every data operation. On the critical path of the walking skeleton (High).
**Dependencies:** TASK-001 >> TASK-002
**Acceptance Criteria:**
1. Sequelize migrations create all 5 tables: users, folders, notes, note_versions, password_reset_tokens
2. All tables use UUID primary keys via `gen_random_uuid()`
3. Foreign key constraints enforced: `ON DELETE CASCADE` on user_id (notes, folders, note_versions, password_reset_tokens), `ON DELETE SET NULL` on folder_id (notes), `ON DELETE CASCADE` on note_id (note_versions)
4. All timestamps are TIMESTAMPTZ, defaulting to NOW()
5. RLS policies enabled and forced on notes, folders, and note_versions tables per ADR-006
6. Application database role (e.g., `braindump_app`) is subject to RLS; migration role bypasses RLS via `SET LOCAL` exempt or role-level exemption (OBS-002)
7. `SET LOCAL app.current_user_id` is executed at the start of each request in middleware
8. The `search_vector` tsvector column exists on notes with GIN index
9. The tsvector trigger function `notes_search_vector_update()` fires on INSERT/UPDATE of title or body
10. Schema introspection test confirms all expected FK constraints exist
**Fitness Functions:** FF-D08, FF-D09, FF-D10, FF-D11, FF-D12, FF-D31
**Note:** OBS-002 from the Auditor -- the migration role that bypasses RLS must be explicitly configured. This is not just a note; it is a testable implementation concern.

---

### TASK-003: User registration
**Requirement(s):** REQ-001
**ADR(s):** ADR-002, ADR-003
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** Auth architecture is a one-way door (ADR-002), but registration itself is a well-understood pattern with bcrypt and express-session. Uses known technology in the auth combination for this project (Medium).
**Value justification:** Walking skeleton entry point. Must Have for this release. Unblocks login and all authenticated features (High).
**Dependencies:** TASK-002 >> TASK-003
**Acceptance Criteria:**
1. A visitor can submit a valid username, email, and password to create an account
2. Password is hashed with bcryptjs (cost factor 12) before storage
3. Email uniqueness enforced by database UNIQUE constraint; duplicate email submission returns a clear error message
4. Password minimum length: 8 characters (server-side validation)
5. On successful registration, a session is created and the user is redirected to the workspace
6. Registration form validates inputs client-side before submission (username, email format, password length)
**Fitness Functions:** FF-D03

---

### TASK-004: User login and logout
**Requirement(s):** REQ-002
**ADR(s):** ADR-002
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard session-based auth with express-session + connect-pg-simple. All patterns well-documented, no unknowns (Low).
**Value justification:** Walking skeleton requirement. Must Have. Unblocks all authenticated workflows (High).
**Dependencies:** TASK-003 >> TASK-004
**Acceptance Criteria:**
1. A registered user can log in with email and password
2. On valid credentials, a server-side session is created (express-session + connect-pg-simple); session cookie is httpOnly, secure (in production), sameSite: strict
3. On invalid credentials, login is rejected with 401 and no session is created
4. An authenticated user can log out; session is destroyed in the PostgreSQL store
5. After logout, accessing protected routes returns 401 and redirects to login
6. Session lifetime: 7 days with rolling expiry (refreshed on activity)
**Fitness Functions:** FF-D03, FF-D04, FF-D07

---

### TASK-005: Ownership guard middleware and data isolation
**Requirement(s):** REQ-011
**ADR(s):** ADR-006
**Priority Group:** P1 | **Risk:** High | **Value:** High
**Risk justification:** One-way door (ADR-006). Data isolation is woven into every data access point. Must get right on first pass -- a missed WHERE clause leaks data (High).
**Value justification:** Security-critical cross-cutting concern. Must Have. Every data feature depends on this being correct (High).
**Dependencies:** TASK-002 >> TASK-005, TASK-004 >> TASK-005
**Acceptance Criteria:**
1. `ownershipGuard` middleware applied to all routes under `/api/notes`, `/api/folders`, `/api/versions`
2. For routes with a resource ID parameter, middleware loads the resource and verifies `resource.user_id === req.session.userId`; if mismatch, returns 404 (not 403)
3. For list/search routes, middleware ensures query includes `WHERE user_id = req.session.userId`
4. Sequelize default scopes on Note, Folder, and NoteVersion models add `WHERE user_id = :currentUserId`
5. Tests: User A cannot access User B's note, folder, or version by direct ID (returns 404)
6. Tests: User A's list endpoints return only User A's resources
7. Tests: deliberately bypassing app-level filter confirms RLS blocks access (validates RLS is active)
**Fitness Functions:** FF-D26, FF-D27, FF-D28, FF-D29, FF-D30, FF-D31

---

### TASK-006: Create a note with persistence
**Requirement(s):** REQ-004, REQ-012
**ADR(s):** ADR-003, ADR-004
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard CRUD with Sequelize on a well-defined schema. No unknowns (Low).
**Value justification:** Walking skeleton core feature. Must Have. First end-to-end data flow through the system (High).
**Dependencies:** TASK-005 >> TASK-006
**Acceptance Criteria:**
1. An authenticated user can create a new note by providing a title via `POST /api/notes`
2. The note is persisted in PostgreSQL with an auto-generated UUID, empty body, and timestamps
3. An initial version (version_number = 1) is created in note_versions with the note's initial content
4. Duplicate titles are allowed (titles are not unique identifiers)
5. The API returns the created note object with id, title, body, created_at, updated_at
6. The note is accessible only to its owner (ownership guard enforced)
**Fitness Functions:** FF-D16

---

### TASK-007: Split-pane Markdown editor with live preview
**Requirement(s):** REQ-007
**ADR(s):** ADR-001, ADR-008, ADR-009
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** CodeMirror 6 integration with React is a known combination but first use in this project. Two-way door for the renderer library, but the editor integration requires getting the component wiring right (Medium).
**Value justification:** The core user experience. Walking skeleton feature. Must Have. Defines the product identity (High).
**Dependencies:** TASK-006 >> TASK-007
**Acceptance Criteria:**
1. The editor displays two panels side by side: left panel is a CodeMirror 6 editor with Markdown syntax highlighting; right panel is a markdown-it rendered HTML preview
2. Every edit in the source panel is reflected in the preview panel without user-initiated action (live rendering)
3. Preview updates with no perceptible delay under normal conditions (< 100ms)
4. Syntax highlighting distinguishes headings, bold, italic, links, lists, code blocks, inline code, code fence markers
5. Rendering conforms to the CommonMark specification (ATX headings, emphasis rules, link syntax parse correctly)
6. Editor panel uses dark background (`bg-editor: #1E1E1E`) with monospace font per ADR-008
7. Preview panel uses light background with system font stack per ADR-008
8. Panel dividers are 1px solid border lines (no shadows, no gradients) per ADR-008
**Fitness Functions:** FF-D02

---

### TASK-008: Note catalog sidebar
**Requirement(s):** REQ-008
**ADR(s):** ADR-008, ADR-009
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard React component listing data from an API. Known patterns, no unknowns (Low).
**Value justification:** Walking skeleton navigation. Must Have. Primary navigation for the note collection (High).
**Dependencies:** TASK-006 >> TASK-008
**Acceptance Criteria:**
1. Sidebar is visible alongside the editor in the workspace layout at desktop viewport (>= 1024px)
2. Sidebar lists all user's notes via `GET /api/notes`, sorted by last modified date (newest first)
3. Each entry shows note title and last modified date; metadata uses `text-secondary` color and 12px font per ADR-008
4. Clicking a note in the catalog opens it in the split-pane editor
5. The catalog remains visible and navigable while a note is being edited
6. Empty state shown when user has no notes, with guidance on creating a first note
7. Sidebar width is 260px per ADR-009
8. Catalog renders without perceptible delay with 200 notes (scrollable)

---

### TASK-009: Edit a note (API and editor integration)
**Requirement(s):** REQ-005
**ADR(s):** ADR-004, ADR-006
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard PUT endpoint with ownership guard. Well-defined API contract from ADR-004 (Low).
**Value justification:** Walking skeleton. Must Have. Completes the write path (High).
**Dependencies:** TASK-007 >> TASK-009, TASK-005 >> TASK-009
**Acceptance Criteria:**
1. An authenticated user can edit the title and body of a note they own via `PUT /api/notes/:id`
2. The note's `updated_at` timestamp is updated on each save
3. Changes in the CodeMirror editor are sent to the API (manual save path; auto-save wiring is TASK-012)
4. Attempting to edit a note owned by another user returns 404
5. The editor loads existing note content (title and body) when opening a note from the catalog

---

### TASK-010: Delete a note
**Requirement(s):** REQ-006
**ADR(s):** ADR-003, ADR-006
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard DELETE endpoint. CASCADE handles version cleanup at DB level. No unknowns (Low).
**Value justification:** Must Have. Completes the core CRUD set. Without deletion, the walking skeleton is incomplete (High).
**Dependencies:** TASK-006 >> TASK-010
**Acceptance Criteria:**
1. An authenticated user can delete a note they own via `DELETE /api/notes/:id`
2. A confirmation step in the UI prevents accidental deletion (confirm dialog)
3. Deletion removes the note and all its versions (CASCADE verified)
4. After deletion, the note no longer appears in the catalog sidebar
5. Canceling the confirmation does not delete the note
6. After deletion, searching for the deleted note's content returns no results
**Fitness Functions:** FF-D09

---

### TASK-011: Public landing page
**Requirement(s):** REQ-017
**ADR(s):** ADR-008
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Static React component. No backend logic beyond route protection. No unknowns (Low).
**Value justification:** Must Have. Entry point for new users. Without this, unauthenticated visitors hit a blank or redirect (High).
**Dependencies:** TASK-003 >> TASK-011 (needs registration route to link to)
**Acceptance Criteria:**
1. Unauthenticated visitors navigating to the root URL see a landing page
2. Landing page contains: app description, feature highlights (Markdown editor, live preview, search, version history), and a registration CTA prominently positioned on the side
3. Login link or button is accessible from the landing page
4. Attempting to access note functionality by direct URL without authentication redirects to login or landing page
5. The page reflects the professional/technical aesthetic per ADR-008 design tokens (neutral palette, system font stack, no decorative elements)
6. Authenticated users navigating to root URL are redirected to their workspace

---

### TASK-012: Auto-save with debounce
**Requirement(s):** REQ-015
**ADR(s):** ADR-004
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** Client-side timer integration with React hooks is a known pattern but the interaction between two independent timers (auto-save + versioning) is architecturally complex. Uses known tech in a new combination (Medium).
**Value justification:** Must Have. Prevents data loss. Core product promise -- no manual save (High).
**Dependencies:** TASK-009 >> TASK-012
**Acceptance Criteria:**
1. `useAutoSave` hook implements a 2-second debounce timer that resets on every keystroke
2. On timer fire, the hook calls `PUT /api/notes/:id` to update the note's working state
3. A visual indicator shows save status: "Saving...", "Saved", "Error"
4. Auto-save updates the `notes` row only; no `note_versions` row is created
5. On auto-save failure (e.g., network error), a visual error indicator is shown
6. After the debounce period, if the browser is closed, no content is lost (content since last successful save may be lost -- acceptable)
7. Multiple rapid edits reset the debounce timer; only the final state after 2 seconds of inactivity is saved
**Fitness Functions:** FF-D13, FF-D18

---

### TASK-013: Note version history (30-second idle timer and version management)
**Requirement(s):** REQ-016
**ADR(s):** ADR-004
**Priority Group:** P1 | **Risk:** Medium | **Value:** High
**Risk justification:** Server-side diff check + client-side idle timer is a new combination for this project. Timer interaction rules with auto-save must be precise. One-way door (ADR-004) (Medium -- elevated from Low because the timer interaction is architecturally complex but patterns are documented in ADR-004).
**Value justification:** Must Have. Users need recovery of prior note states. Core differentiator (High).
**Dependencies:** TASK-012 >> TASK-013 (auto-save must exist first; shared note update path per Architect guidance)
**Acceptance Criteria:**
1. `useVersionTimer` hook implements a 30-second idle timer that resets on every keystroke
2. On timer fire, the hook calls `POST /api/notes/:id/check-version`
3. Server-side `versionService` loads the latest version from `note_versions`, compares body with current `notes.body`
4. If content differs (any change, even a single character), a new `note_versions` row is inserted with incremented `version_number`
5. If content has NOT changed since the last version, no new version is created
6. Version list endpoint (`GET /api/notes/:id/versions`) returns all versions, newest first, with timestamps
7. Version detail endpoint (`GET /api/notes/:id/versions/:version_id`) returns the content of a specific version (read-only)
8. Restore endpoint (`POST /api/notes/:id/versions/:version_id/restore`) updates the note's content with the restored version's content and creates a new version entry (capturing the state before restoration)
9. A note with 100 versions shows all 100 in the history (no pruning)
10. Version history UI component displays the version list and allows viewing/restoring
**Fitness Functions:** FF-D14, FF-D15, FF-D16, FF-D17, FF-D18

---

### TASK-014: Full-text search
**Requirement(s):** REQ-010
**ADR(s):** ADR-005, ADR-006
**Priority Group:** P2 | **Risk:** Medium | **Value:** High
**Risk justification:** PostgreSQL FTS with tsvector/GIN is a known technology but used here in a specific combination (weighted vectors, ts_headline, query sanitization). Two-way door per ADR-005 (Medium).
**Value justification:** Must Have for this release. Directly addresses validated user need (Carla's keyword search). But not on walking skeleton critical path (High -- but scheduled after core CRUD).
**Dependencies:** TASK-002 >> TASK-014 (tsvector trigger in schema), TASK-005 >> TASK-014 (isolation in search)
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
**Priority Group:** P2 | **Risk:** Medium | **Value:** Medium
**Risk justification:** Involves external email service integration boundary and token-based flow. Known patterns but the email provider integration is an external dependency not fully documented (Medium).
**Value justification:** Must Have for this release, but not on the walking skeleton critical path. Supports existing users, not the core creation flow (Medium -- Must Have but future-release-adjacent; users can use the product without it initially).
**Dependencies:** TASK-003 >> TASK-015 (needs user accounts to reset)
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

### TASK-016: Workspace layout shell and routing
**Requirement(s):** REQ-007, REQ-008, REQ-017
**ADR(s):** ADR-009, ADR-008
**Priority Group:** P1 | **Risk:** Low | **Value:** High
**Risk justification:** Standard React routing and CSS Grid layout. Known patterns, no unknowns (Low).
**Value justification:** Walking skeleton structural foundation. The three-panel workspace layout is the canvas all other features render into (High).
**Dependencies:** TASK-001 >> TASK-016
**Acceptance Criteria:**
1. React SPA with client-side routing: root `/` shows landing page or redirects to workspace for authenticated users
2. Workspace route requires authentication; unauthenticated access redirects to login
3. Workspace layout uses CSS Grid with three column tracks: sidebar (260px), editor (1fr), preview (1fr)
4. Layout renders correctly at 1920px desktop viewport (all three panels visible)
5. Tailwind CSS configured with design tokens from ADR-008 (color palette, typography, spacing)
6. The `tailwind.config.js` contains the locked design token system as specified in ADR-008

---

### TASK-017: Organize notes in folders
**Requirement(s):** REQ-009
**ADR(s):** ADR-003
**Priority Group:** P2 | **Risk:** Low | **Value:** Medium
**Risk justification:** Standard CRUD on a well-defined schema with known patterns. No unknowns (Low).
**Value justification:** Should Have for this release. Not on the critical path. Organizational convenience feature (Medium -- Should Have, this release).
**Dependencies:** TASK-006 >> TASK-017, TASK-005 >> TASK-017
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

### TASK-018: Responsive design -- tablet and mobile breakpoints
**Requirement(s):** REQ-013
**ADR(s):** ADR-009
**Priority Group:** P3 | **Risk:** Low | **Value:** Medium
**Risk justification:** CSS-only progressive collapse with media queries. Two-way door. No unknowns (Low).
**Value justification:** Should Have. Not on the critical path. Desktop is the primary use case (Medium -- Should Have, this release).
**Dependencies:** TASK-016 >> TASK-018, TASK-007 >> TASK-018, TASK-008 >> TASK-018
**Acceptance Criteria:**
1. At 768px-1023px: editor + preview visible; sidebar collapsed behind a hamburger toggle (top-left)
2. At < 768px: single panel visible at a time; tab bar ("Notes" / "Edit" / "Preview") for panel switching
3. Sidebar overlay on tablet (fixed position, slides in from left with 0.2s transition)
4. No horizontal scrollbar at 375px, 768px, 1024px, or 1920px viewport widths
5. All interactive elements have minimum 44px touch targets on viewports < 768px
6. Tab bar uses clear labels, not icons alone
**Fitness Functions:** FF-D38, FF-D39, FF-D40, FF-D41, FF-D42

---

### TASK-019: Account deletion
**Requirement(s):** REQ-014
**ADR(s):** ADR-002, ADR-003
**Priority Group:** P3 | **Risk:** Low | **Value:** Low
**Risk justification:** CASCADE deletes handle all cleanup at DB level. Standard flow with confirmation (Low).
**Value justification:** Should Have. Not on the critical path, not on any high-value dependency chain. Users rarely delete accounts (Low -- Should Have, could be deferred).
**Dependencies:** TASK-003 >> TASK-019, TASK-004 >> TASK-019
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
**Value justification:** Quality/resilience of existing features. Ensures fitness functions are automated in CI (Medium).
**Dependencies:** TASK-012 >> TASK-020, TASK-013 >> TASK-020, TASK-014 >> TASK-020 (needs features built to test them)
**Acceptance Criteria:**
1. All FF-D01 through FF-D43 dev-side fitness functions are implemented as automated tests in the test suite
2. Tests are organized by ADR/concern area (auth, durability, auto-save, versioning, search, isolation, deploy, aesthetic, responsive)
3. CI pipeline runs all fitness function tests as part of the standard test suite
4. Each test references its FF-ID in a comment for traceability
5. Lighthouse CI audit integrated for FF-D02 (LCP, bundle size), FF-D36 (accessibility)
6. ESLint rule configured for FF-D37 (no inline styles overriding Tailwind)
7. CI flags changes to `tailwind.config.js` for review (FF-D35)
**Note:** Many individual FF checks will be written as acceptance tests within each task. This task captures the comprehensive instrumentation pass that ensures full coverage and CI integration.

---

### TASK-021: DevOps Phase 2 -- staging environment and CD pipeline
**Requirement(s):** REQ-012, Manifest CD philosophy
**ADR(s):** ADR-007
**Priority Group:** P2 | **Risk:** Medium | **Value:** Medium
**Risk justification:** First deployment to nxlabs.cc infrastructure. Integrating with Traefik, Watchtower, and shared PostgreSQL is a new combination for this project (Medium).
**Value justification:** Enables continuous delivery flow. Required before Go-Live but not before feature development (Medium).
**Dependencies:** TASK-001 >> TASK-021 (CI must exist first)
**DevOps Phase:** 2
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

### TASK-022: DevOps Phase 3 -- production environment and Go-Live preparation
**Requirement(s):** REQ-012, Manifest Go-Live Gate
**ADR(s):** ADR-007
**Priority Group:** P3 | **Risk:** Medium | **Value:** Medium
**Risk justification:** Production deployment follows staging patterns, but production has real user data at stake. Same infrastructure integration but higher consequences (Medium).
**Value justification:** Required for Go-Live. Not needed during development cycles (Medium).
**Dependencies:** TASK-021 >> TASK-022 (staging must work first)
**DevOps Phase:** 3
**Acceptance Criteria:**
1. Docker Compose file for production at `/opt/braindump/docker-compose.prod.yml` per ADR-007
2. Production database provisioned via `provision.sh braindump-prod` on nxlabs.cc
3. Production `.env.prod` configured with production database URL, unique session secret, real email provider, and `NODE_ENV=production`
4. Container joins `traefik` and `postgres` external Docker networks
5. Traefik routes `braindump.nxlabs.cc` to the production container
6. Watchtower configured for `:latest` tag polling
7. Uptime Kuma monitoring active at status.nxlabs.cc
8. Tag promotion workflow documented: operator re-tags `:staging` as `:latest` after Nexus approval
9. Rollback procedure documented: revert image tag to previous `:latest`
10. Email provider configured and tested for password reset emails
**Fitness Functions:** FF-P01, FF-P14, FF-P15

---

### TASK-023: Production monitoring and fitness function instrumentation (prod-side)
**Requirement(s):** Cross-cutting (FF-P01 through FF-P15)
**ADR(s):** ADR-001 through ADR-009
**Priority Group:** P3 | **Risk:** Low | **Value:** Medium
**Risk justification:** Monitoring setup with known tools (Uptime Kuma, application logging). No unknowns (Low).
**Value justification:** Required before Go-Live. Supports quality/resilience of deployed features (Medium).
**Dependencies:** TASK-022 >> TASK-023
**DevOps Phase:** 3
**Acceptance Criteria:**
1. Application logs structured for production monitoring (JSON format recommended)
2. Auto-save error rate trackable via application logs (FF-P08: warn > 0.1%, critical > 1%)
3. Search query latency logged at p95 level (FF-P09: warn > 500ms, critical > 2000ms)
4. RLS policy violations logged and alertable (FF-P11: any violation is critical)
5. 401 response rate monitoring for auth security (FF-P03)
6. Password reset request rate per IP logged (FF-P04: warn > 10 req/min)
7. Health check endpoint verified as Uptime Kuma target (FF-P01)
8. JS error boundary in React catches and logs client-side errors (FF-P02: warn > 1% sessions)
**Fitness Functions:** FF-P01 through FF-P15 (excluding FF-P05, FF-P06 which are N/A, and FF-P13 which is infra-managed)
**Note for OBS-001:** REQ-012 acceptance scenario 2 (backup verification) is an infrastructure acceptance test owned by the nxlabs team. The Verifier should handle this as infrastructure verification, not a code test.

---

### TASK-024: Rate limiting on authentication endpoints (SEC-001)
**Requirement(s):** REQ-001, REQ-002 (security hardening)
**ADR(s):** ADR-002
**Priority Group:** P2 | **Risk:** Low | **Value:** High
**Risk justification:** Well-understood middleware (`express-rate-limit`), no architectural unknowns (Low).
**Value justification:** Sentinel finding SEC-001 (High severity). Brute-force and credential stuffing protection for login and registration endpoints. Blocks Demo Sign-off until resolved (High).
**Dependencies:** TASK-004 >> TASK-024 (auth endpoints must exist)
**Source:** Sentinel Cycle 1 Security Report -- SEC-001
**Acceptance Criteria:**
1. `express-rate-limit` is installed as a production dependency in `backend/package.json`
2. `POST /api/auth/login` is rate-limited to 10 requests per 15-minute window per IP address; exceeding the limit returns HTTP 429 with a clear error message
3. `POST /api/auth/register` is rate-limited to 10 requests per 15-minute window per IP address; exceeding the limit returns HTTP 429 with a clear error message
4. Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are included in responses to rate-limited endpoints
5. Rate limiter uses the default in-memory store (acceptable for single-instance deployment per ADR-001)
6. Existing authentication tests continue to pass (no regressions)
**Fitness Functions:** FF-D03, FF-D04

---

## Pass 2: Scoring Summary and Priority Matrix

### Scoring Table

| Task | Risk | Value | Priority | Justification Summary |
|---|---|---|---|---|
| TASK-001 | Medium | High | P1 | CI pipeline is precondition for everything |
| TASK-002 | High | High | P1 | One-way door schema + RLS role separation (OBS-002) |
| TASK-003 | Medium | High | P1 | Walking skeleton entry point |
| TASK-004 | Low | High | P1 | Walking skeleton -- quick win, schedule early in P1 |
| TASK-005 | High | High | P1 | One-way door security cross-cut |
| TASK-006 | Low | High | P1 | Walking skeleton -- quick win |
| TASK-007 | Medium | High | P1 | Core product experience |
| TASK-008 | Low | High | P1 | Walking skeleton navigation -- quick win |
| TASK-009 | Low | High | P1 | Walking skeleton write path -- quick win |
| TASK-010 | Low | High | P1 | Completes CRUD -- quick win |
| TASK-011 | Low | High | P1 | Entry point for visitors -- quick win |
| TASK-012 | Medium | High | P1 | Must Have, prevents data loss |
| TASK-013 | Medium | High | P1 | Must Have, version recovery |
| TASK-014 | Medium | High | P2 | Must Have but not on walking skeleton critical path |
| TASK-015 | Medium | Medium | P2 | Must Have but not critical path |
| TASK-016 | Low | High | P1 | Walking skeleton layout -- quick win, schedule early |
| TASK-017 | Low | Medium | P2 | Should Have, reliable value |
| TASK-018 | Low | Medium | P2 | Should Have, reliable value |
| TASK-019 | Low | Low | DEFERRED | Should Have, cut candidate |
| TASK-020 | Low | Medium | P2 | Quality instrumentation |
| TASK-021 | Medium | Medium | P2 | Enables CD, needed before Go-Live |
| TASK-022 | Medium | Medium | P3 | Production setup, needed before Go-Live only |
| TASK-023 | Low | Medium | P3 | Monitoring, needed before Go-Live only |
| TASK-024 | Low | High | P2 | SEC-001 remediation: rate limiting on auth endpoints |

### Walking Skeleton (Cycle 1 Target)

The walking skeleton demonstrates the thinnest end-to-end path:

**User registers -> logs in -> sees workspace (3-panel layout) -> creates a note -> types Markdown in editor -> sees live preview -> note is auto-saved to PostgreSQL -> user logs out -> logs back in -> note is still there**

This touches: REQ-001, REQ-002, REQ-004, REQ-005, REQ-007, REQ-008, REQ-012, REQ-015, REQ-017

Tasks in the walking skeleton: TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-016

### P1 Execution Order (within Cycle 1)

Dependencies constrain; within P1, Low Risk tasks are scheduled before Medium/High Risk tasks of equal value when dependencies allow.

```
TASK-001 (DevOps Phase 1 -- CI pipeline)
    |
    +---> TASK-016 (Workspace layout shell -- Low Risk, quick win)
    |
    +---> TASK-002 (Schema + migrations + RLS -- High Risk, do first)
              |
              +---> TASK-003 (Registration -- Medium Risk)
              |         |
              |         +---> TASK-004 (Login/Logout -- Low Risk, quick win)
              |         |         |
              |         |         +---> TASK-005 (Ownership guard -- High Risk, do first after auth)
              |         |                   |
              |         |                   +---> TASK-006 (Create note -- Low Risk, quick win)
              |         |                   |         |
              |         |                   |         +---> TASK-008 (Catalog sidebar -- Low Risk, quick win)
              |         |                   |         |
              |         |                   |         +---> TASK-007 (Editor + preview -- Medium Risk)
              |         |                   |         |         |
              |         |                   |         |         +---> TASK-009 (Edit note -- Low Risk, quick win)
              |         |                   |         |                   |
              |         |                   |         |                   +---> TASK-012 (Auto-save -- Medium Risk)
              |         |                   |         |                             |
              |         |                   |         |                             +---> TASK-013 (Versioning -- Medium Risk)
              |         |                   |         |
              |         |                   |         +---> TASK-010 (Delete note -- Low Risk, quick win)
              |         |                   |
              |         +---> TASK-011 (Landing page -- Low Risk, quick win)
```

**Linear execution order for Cycle 1:**
1. TASK-001 -- DevOps Phase 1: CI pipeline
2. TASK-016 -- Workspace layout shell (can parallel with TASK-002 but listed after for Builder focus)
3. TASK-002 -- Database schema + RLS
4. TASK-003 -- Registration
5. TASK-004 -- Login/Logout
6. TASK-005 -- Ownership guard
7. TASK-006 -- Create note
8. TASK-008 -- Catalog sidebar
9. TASK-011 -- Landing page
10. TASK-007 -- Editor + preview
11. TASK-009 -- Edit note
12. TASK-010 -- Delete note
13. TASK-012 -- Auto-save
14. TASK-013 -- Versioning

**Scaffolder invocation:** Cycle 1 has 14 Builder tasks (>= 3), so the Scaffolder is invoked before the first Builder task to set up the project skeleton using the Architect's component map.

---

### Priority Matrix Visualization

```
              |  HIGH VALUE          |  MEDIUM VALUE         |  LOW VALUE
--------------+----------------------+-----------------------+-----------------
HIGH RISK     |  P1: TASK-002,       |                       |
              |  TASK-005            |                       |
--------------+----------------------+-----------------------+-----------------
MEDIUM RISK   |  P1: TASK-001,       |  P2: TASK-015,        |
              |  TASK-003,           |  TASK-021             |
              |  TASK-007,           |  P3: TASK-022         |
              |  TASK-012,           |                       |
              |  TASK-013            |                       |
              |  P2: TASK-014        |                       |
--------------+----------------------+-----------------------+-----------------
LOW RISK      |  P1: TASK-004,       |  P2: TASK-017,        |  DEFERRED:
              |  TASK-006,           |  TASK-018,            |  TASK-019
              |  TASK-008,           |  TASK-020             |
              |  TASK-009,           |  P3: TASK-023         |
              |  TASK-010,           |                       |
              |  TASK-011,           |                       |
              |  TASK-016            |                       |
```

---

## Pass 3: Release Map and Cycle Plan

### Release Map

#### MVP (Release 1) -- Confidence: Firm

**Release criterion:** A user can register, log in, create and edit Markdown notes with live preview and auto-save, browse their catalog, search their notes, view and restore version history, and reset a forgotten password. Public landing page attracts new users. All data is isolated per user. Deployed to production on nxlabs.cc.

**Scope:** All Must Have requirements (REQ-001 through REQ-008, REQ-010 through REQ-012, REQ-015 through REQ-017)

**Explicitly excluded from MVP:**
- REQ-009 (Folders) -- Should Have; organizational convenience, not core value
- REQ-013 (Responsive design) -- Should Have; desktop is the primary use case
- REQ-014 (Account deletion) -- Should Have; low urgency

#### Release 2 -- Confidence: Planned

**Business value:** Organizational features and polish for broader device support.

**Scope:**
- REQ-009 (Folders)
- REQ-013 (Responsive design -- tablet and mobile breakpoints)
- REQ-014 (Account deletion)

#### Unplaced Requirements

None. All 17 requirements are placed.

---

### Cycle Plan

#### Cycle 1: Walking Skeleton + Core Features
**Tasks:** TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-016
**Priority Group:** P1
**Demo:** User registers, logs in, sees three-panel workspace, creates a note, types Markdown with live preview, content auto-saves, version is created after 30s idle, user views and restores a version, deletes a note, visits landing page as unauthenticated visitor, logs out and back in with data intact.
**Scaffolder:** Yes (14 Builder tasks)
**Walking skeleton achieved:** Yes -- end-to-end path through every major layer

#### Cycle 2: Search, Password Reset, Folders, Quality, and Security Hardening
**Tasks:** TASK-014, TASK-015, TASK-017, TASK-018, TASK-020, TASK-021, TASK-024
**Priority Group:** P2
**Demo:** User searches notes by keyword (title and body matches with relevance ranking), resets forgotten password via email link, organizes notes into folders, responsive layout at tablet breakpoints. CI/CD pipeline deploys to staging automatically.
**Scaffolder:** Yes (7 Builder tasks)

#### Cycle 3: Production Readiness
**Tasks:** TASK-022, TASK-023
**Priority Group:** P3
**Demo:** Application running on production at braindump.nxlabs.cc with monitoring, health checks, and documented rollback procedure.
**Scaffolder:** No (2 tasks)

---

### Cut Line

```
-- CYCLE 1 (P1) -------- Walking skeleton + core Must Have features
-- CYCLE 2 (P2) -------- Search, password reset, folders, responsive, quality instrumentation, staging
-- CYCLE 3 (P3) -------- Production environment, monitoring
-- CUT LINE --------------------------------------------------------
-- DEFERRED:
   TASK-019: Account deletion (REQ-014, Should Have)
```

**What is below the cut line:**
- **TASK-019 (Account deletion):** REQ-014, Should Have. Users can delete their accounts and all associated data.

**What is lost if it stays cut:**
- Users cannot self-service delete their accounts. Account deletion would require manual database intervention. This is a data governance gap but does not affect core product functionality.

**What it would cost to include:**
- One Builder session (small task -- CASCADE does the heavy lifting). Low risk, low complexity. Could be added to Cycle 2 if the Nexus decides.

---

## Summary

| Metric | Count |
|---|---|
| Total tasks | 24 |
| Cycle 1 tasks (P1) | 14 |
| Cycle 2 tasks (P2) | 7 |
| Cycle 3 tasks (P3) | 2 |
| Deferred (below cut line) | 1 |
| Requirements covered | 17/17 |
| Must Have requirements | 13 (all in Cycles 1-2) |
| Should Have requirements | 3 in Cycle 2, 1 deferred |
| Walking skeleton | Cycle 1 |
| MVP boundary | End of Cycle 3 (all Must Have features + production deployment) |
| Spikes | 0 (no unresolved architectural unknowns) |
| Fitness functions covered | 55/55 (42 dev in TASK-020, 13 prod in TASK-023; 2 N/A) |

---

## Handoff Notes

**For the Orchestrator:**
- The top of the plan is Cycle 1 (14 P1 tasks) because it produces the walking skeleton -- the thinnest end-to-end slice through every layer
- The cut line sits after Cycle 3, with only TASK-019 (account deletion) below it -- present this to the Nexus at the Plan Gate
- No spike tasks -- all architectural unknowns were resolved at the Architecture Gate
- Scaffolder should be invoked before the first Builder task in Cycle 1 (14 tasks >= 3 threshold) and Cycle 2 (6 tasks >= 3 threshold)
- TASK-012 (auto-save) and TASK-013 (versioning) must be planned sequentially per Architect guidance -- they share the note update path
- OBS-002 (migration role RLS bypass) is captured as an explicit acceptance criterion in TASK-002
- OBS-001 (backup verification) is flagged in TASK-023 -- the Verifier handles it as infrastructure verification, not a code test

**For the Nexus at Plan Gate:**
- The MVP requires completing all three cycles (Cycles 1-2 for features, Cycle 3 for production deployment)
- Only one task (TASK-019, account deletion) is proposed for deferral. The Nexus may choose to include it in Cycle 2 at minimal cost
- Auto-save and versioning are the most architecturally complex features and are scheduled at the end of Cycle 1 so the simpler CRUD tasks build momentum first
