# Architectural Audit Report -- BrainDump
**Audit Version:** 1 | **Date:** 2026-03-19 | **Artifact Weight:** Draft
**Architecture Version Audited:** 1 (overview + 9 ADRs + fitness functions index)
**Requirements Version Referenced:** 2 (approved with deferrals at Nexus Check)
**Profile:** Commercial | **Gate:** Architecture Gate

---

## Result: PASS

**17 requirements checked for architectural coverage. 9 ADRs checked for inter-consistency. All fitness functions checked for NFR traceability. 0 blocking issues. 1 prior deferral (AUDIT-003) now resolved by ADR-008.**

---

## Check 1: Architectural Coverage

Every approved requirement must have a corresponding architectural provision. A requirement with no architectural home is a silent gap.

| REQ | Title | Priority | Architectural Provision | Result |
|---|---|---|---|---|
| REQ-001 | User registration | Must Have | ADR-002 (registration flow, email UNIQUE constraint, bcrypt hashing); ADR-003 (users table schema) | COVERED |
| REQ-002 | User login and logout | Must Have | ADR-002 (express-session + connect-pg-simple, session lifecycle, cookie configuration); ADR-003 (sessions table) | COVERED |
| REQ-003 | Password reset | Must Have | ADR-002 (password_reset_tokens table, DB-stored token with hash, 1-hour expiry, email integration boundary, no user enumeration); ADR-003 (password_reset_tokens schema) | COVERED |
| REQ-004 | Create a note | Must Have | ADR-003 (notes table schema); ADR-001 (React component map: Editor, Sidebar); Architecture overview component map | COVERED |
| REQ-005 | Edit a note | Must Have | ADR-001 (CodeMirror 6 editor, React); ADR-004 (auto-save integration via PUT /api/notes/:id); ADR-006 (ownership guard on edit routes) | COVERED |
| REQ-006 | Delete a note | Must Have | ADR-003 (ON DELETE CASCADE on note_id for note_versions); ADR-006 (ownership verification before delete) | COVERED |
| REQ-007 | Split-pane Markdown editor | Must Have | ADR-001 (CodeMirror 6 with React bindings for source panel, markdown-it for preview panel); ADR-008 (dark editor panel aesthetic, monospace typography); ADR-009 (progressive collapse on narrow viewports) | COVERED |
| REQ-008 | Note catalog sidebar | Must Have | ADR-001 (React Sidebar component); ADR-008 (design tokens for catalog: text-secondary for metadata, spacing system); ADR-009 (sidebar collapse behavior at breakpoints, 260px fixed width) | COVERED |
| REQ-009 | Organize notes in folders | Should Have | ADR-003 (folders table, ON DELETE SET NULL moves notes to root); Architecture overview component map (Folders routes) | COVERED |
| REQ-010 | Full-text search | Must Have | ADR-005 (tsvector column with GIN index, weighted vectors title=A/body=B, ts_rank ordering, query sanitization, ts_headline snippets); ADR-006 (per-user isolation in search queries) | COVERED |
| REQ-011 | Per-user data isolation | Must Have | ADR-006 (dual-layer: application middleware ownershipGuard.js + Sequelize default scope + PostgreSQL RLS policies; 404 response to prevent enumeration) | COVERED |
| REQ-012 | Data durability / PostgreSQL | Must Have | ADR-003 (normalized relational schema, FK constraints with CASCADE/SET NULL, WAL-mode PostgreSQL, backup delegation to nxlabs infra team); ADR-007 (separate databases per environment, migration-on-startup pattern) | COVERED |
| REQ-013 | Responsive web design | Should Have | ADR-009 (progressive collapse: 3 panels >= 1024px, 2 panels 768-1023px, 1 panel < 768px; CSS Grid layout; 44px touch targets; panel priority order) | COVERED |
| REQ-014 | Account deletion | Should Have | ADR-003 (ON DELETE CASCADE on user_id removes all notes, versions, folders, reset tokens); ADR-002 (session invalidation on account deletion via CASCADE) | COVERED |
| REQ-015 | Auto-save | Must Have | ADR-004 (2-second client-side debounce, PUT /api/notes/:id updates notes row only, save status indicator, no version creation) | COVERED |
| REQ-016 | Note version history | Must Have | ADR-004 (30-second client-side idle timer, POST /api/notes/:id/check-version, server-side diff check, note_versions table, version restore API, initial version on note creation, multiple-tab handling) | COVERED |
| REQ-017 | Public landing page | Must Have | ADR-001 (React); Architecture overview component map (Landing/ component); ADR-008 (professional/technical aesthetic tokens apply to all surfaces including landing page) | COVERED |

**Coverage result: 17/17 requirements covered. No [UNCOVERED] flags.**

---

## Check 2: Architectural Consistency

Do the ADRs contradict each other? Two decisions that cannot both hold simultaneously are an inconsistency.

### ADR pairs examined for potential contradictions:

**ADR-003 (backup strategy) vs. ADR-007 (deployment model):**
ADR-003's trade-off analysis recommends "daily pg_dump with retention." The Decision section then states backup responsibility is "CLOSED" and delegated to the nxlabs infrastructure team. ADR-007 confirms: "Database backups are the infrastructure's responsibility." These are consistent -- the trade-off analysis provides rationale for the *approach* the infra team should take; the decision delegates execution. No contradiction.

**ADR-004 (auto-save/versioning) vs. ADR-003 (schema):**
ADR-004 specifies auto-save updates the notes row; version creation inserts into note_versions. ADR-003's schema supports this: notes.body holds the working state, note_versions stores immutable snapshots. The search_vector trigger fires on notes INSERT/UPDATE (ADR-005), which means auto-save triggers tsvector recomputation. This is noted as a consequence in ADR-005 ("the tsvector trigger fires on every note INSERT and UPDATE including auto-save") and is accepted as negligible overhead. Consistent.

**ADR-006 (RLS with FORCE) vs. ADR-003/ADR-007 (migrations):**
ADR-006 uses FORCE ROW LEVEL SECURITY, which applies RLS even to table owners. ADR-007 specifies migrations run via Sequelize CLI in the Docker entrypoint. The migration role must bypass RLS. ADR-006's Consequences section addresses this: "the superuser/migration user must bypass RLS for administrative operations -- handled by using a separate database role." ADR-007's database provisioning (provision.sh) creates per-environment users (braindump_prod, braindump_staging). The migration role configuration is an implementation detail that the Builder must handle, but the architecture acknowledges the need. Consistent.

**ADR-001 (Tailwind 3.x) vs. ADR-008 (design tokens):**
ADR-001 specifies Tailwind CSS 3.x. ADR-008 defines the token system within tailwind.config.js. These are complementary. Consistent.

**ADR-002 (session cookies sameSite: strict) vs. ADR-007 (Traefik routing):**
sameSite: strict means the session cookie is only sent for same-site requests. Since BrainDump is served from braindump.nxlabs.cc and all API calls are to the same origin, strict is correct. No cross-site requests are needed (password reset links navigate to the same domain). Consistent.

**Consistency result: No [INCONSISTENCY] flags.**

---

## Check 3: Architectural Coherence

Does the proposed architecture credibly solve the requirements it claims to address?

**REQ-011 (Data isolation) via ADR-006:**
The dual-layer approach (application middleware + RLS) is credible and well-specified. The ownership guard middleware checks resource ownership before every operation. The Sequelize default scope adds a WHERE user_id filter as a second application-level net. RLS policies provide a database-level backstop. The 404-not-403 response prevents resource enumeration. This is defense in depth applied correctly. Credible.

**REQ-012 (Data durability) via ADR-003:**
Normalized schema with FK constraints, WAL-mode PostgreSQL, and migration testing in CI address application-level durability. Backup delegation to nxlabs infra is a conscious trade-off acknowledged in the consequences. The architecture correctly identifies that BrainDump cannot control shared infrastructure backup policy and does not pretend to. Credible.

**REQ-015/REQ-016 (Auto-save and versioning) via ADR-004:**
The two-timer architecture with client-side debounce for auto-save and server-side diff check for version creation maps directly to the requirements' non-overlapping specification. The timer interaction rules (both reset on keystroke, auto-save fires at t=2s, version check at t=30s) are deterministic and testable. Edge cases (new note initial version, version restore, multiple tabs) are addressed. Credible.

**REQ-010 (Full-text search) via ADR-005:**
Pre-computed tsvector with GIN index, weighted vectors (title=A, body=B), and ts_rank ordering directly address the requirement for PostgreSQL-backed, relevance-ranked search across both title and body. The query pattern includes per-user isolation. Search-as-you-type via prefix matching is a reasonable UX enhancement. Credible.

**REQ-013 (Responsive design) via ADR-009:**
Progressive collapse with CSS Grid at defined breakpoints (1024px, 768px) directly addresses the requirement for graceful degradation from desktop to mobile. Panel priority (sidebar hides first, then preview, editor always visible) preserves the core editing experience. Touch target minimums (44px) address mobile usability. Credible.

**REQ-007 (Split-pane editor) via ADR-001:**
CodeMirror 6 provides Markdown syntax highlighting with official React bindings. markdown-it is CommonMark-compliant and fast enough for keystroke-level re-rendering. The component map shows Editor/ and Preview/ as separate React components. ADR-009 handles responsive degradation of the split pane. Credible.

**REQ-017 (Landing page) via ADR-001 + ADR-008:**
The component map includes Landing/ as a distinct React component. ADR-008's design tokens apply to all surfaces. The landing page is a relatively simple static component; the architectural provision (React component + aesthetic constraints) is proportionate. Credible.

**Coherence result: No [INADEQUATE] flags.**

---

## Check 4: Fitness Function Traceability

Every fitness function must correspond to a stated NFR. A fitness function with no requirement behind it has no owner.

| Fitness Function(s) | Traced NFR | Result |
|---|---|---|
| FF-D01, FF-D02, FF-P02 | Build integrity, bundle size, client stability -- traceable to ADR-001's maintainability driver, and indirectly to REQ-007 (editor responsiveness) and REQ-013 (page load) | TRACED |
| FF-D03 through FF-D07, FF-P03, FF-P04 | Auth security -- traceable to REQ-001 (registration), REQ-002 (login/logout), REQ-003 (password reset, no enumeration) | TRACED |
| FF-D08 through FF-D12, FF-P05 (N/A), FF-P06 (N/A), FF-P07 | Data durability -- traceable to REQ-012 | TRACED |
| FF-D13 through FF-D18, FF-P08 | Auto-save and versioning -- traceable to REQ-015 and REQ-016 | TRACED |
| FF-D19 through FF-D25, FF-P09, FF-P10 | Search performance and correctness -- traceable to REQ-010 | TRACED |
| FF-D26 through FF-D31, FF-P11, FF-P12 | Data isolation -- traceable to REQ-011 | TRACED |
| FF-D32 through FF-D34, FF-D43, FF-P01, FF-P13 (infra), FF-P14, FF-P15 | Deployment, availability, infrastructure -- traceable to REQ-012 (durability via deployment reliability) and the Manifest's CD philosophy | TRACED |
| FF-D35 through FF-D37 | Design aesthetic -- traceable to Brief Ground Truths (professional/technical aesthetic), REQ-007, REQ-017, and now ADR-008's resolution of AUDIT-003 | TRACED |
| FF-D38 through FF-D42 | Responsive design -- traceable to REQ-013 | TRACED |

**Traceability result: No [UNGROUNDED] flags. All 55 fitness functions (42 dev + 15 prod, with 2 marked N/A) trace to stated requirements or Manifest constraints.**

---

## Prior Deferral Review

### AUDIT-003: Professional/technical design aesthetic
**Previous status:** [DEFERRED] -- non-blocking, carried forward from requirements audit v1 through v2
**Trigger for resolution:** Architecture Gate review
**Current status:** RESOLVED

ADR-008 provides:
1. Concrete, verifiable design tokens (13 colors, typography stack, 5 spacing values, 6 layout principles)
2. Tailwind CSS configuration as an enforcement mechanism with CI-flagging of config changes (FF-D35)
3. Explicit anti-pattern list making "professional/technical" objective rather than subjective
4. Explicit statement that the token system applies to ALL UI surfaces, including REQ-008 (catalog) and REQ-010 (search results) which did not individually reference the aesthetic
5. Three fitness functions (FF-D35 config freeze, FF-D36 accessibility, FF-D37 no inline overrides)

AUDIT-003 is closed. No further tracking required.

---

## Architecture Deferred Decisions Review

The Architecture Overview documents 5 deferred decisions. Each is reviewed for validity:

| Decision | Rationale | Trigger | Valid deferral? |
|---|---|---|---|
| Note export format | Out of scope for v1 per Brief | Export feature added in future cycle | Yes -- Brief explicitly excludes export |
| Application-level rate limiting | CrowdSec provides server-level rate limiting | Sentinel review or observed abuse despite CrowdSec | Yes -- baseline protection exists; augmentation deferred to Sentinel |
| CDN for static assets | Single-server deployment sufficient for current scale | Response time issues from distant locations | Yes -- premature optimization for current user base |
| WebSocket for real-time sync | No collaboration feature in v1 | Real-time collaboration added | Yes -- no requirement demands it |
| Database connection pooling tuning | Default pool settings sufficient for 5-50 concurrent users | Connection saturation observed in monitoring | Yes -- premature tuning without production data |

All 5 deferred decisions have a stated rationale and a concrete trigger. None is a gap in disguise.

---

## Observations (Non-Blocking)

### OBS-001: Backup verification acceptance scenario
REQ-012 acceptance scenario 2 states: "Given the PostgreSQL database / When a backup is executed / Then a restorable backup artifact is produced and its integrity can be verified." ADR-003 delegates backup responsibility entirely to the nxlabs infrastructure team, and FF-P05/FF-P06 are marked N/A.

This is not a contradiction -- the acceptance scenario can be satisfied by the nxlabs team demonstrating backup capability during the deployment verification phase. However, the Planner should note that this scenario is not testable by BrainDump's own test suite. The Verifier will need to coordinate with infrastructure verification or mark this scenario as an infrastructure acceptance test.

### OBS-002: Migration role and RLS bypass
ADR-006 acknowledges that the migration/administrative database role must bypass RLS. ADR-007's provision.sh creates per-environment database users. The Builder must ensure that the provisioned database user (e.g., braindump_prod) is configured with appropriate role separation: the application connects as a role subject to RLS, while migrations may require a privileged role or explicit RLS exemption. This is an implementation detail, not an architectural gap, but it requires attention during the Builder phase.

### OBS-003: Auto-save debounce duration now specified
The requirements audit noted that REQ-015's "short debounce" was unspecified. ADR-004 has resolved this to 2 seconds, documented as a tunable constant. The Planner and Builder have a concrete value to implement.

---

## Security Assessment (Commercial Profile -- Sentinel Active)

The architecture addresses security at multiple layers:

| Security Concern | Architectural Provision | Adequate? |
|---|---|---|
| Authentication | bcrypt (cost 12), server-side sessions, httpOnly/secure/sameSite:strict cookies (ADR-002) | Yes |
| User enumeration prevention | 404 on ownership failures (ADR-006), identical response on password reset for registered/unregistered emails (ADR-002), UUID primary keys (ADR-003) | Yes |
| Session security | PostgreSQL-backed sessions survive restarts, invalidated on logout and account deletion, 7-day rolling expiry (ADR-002) | Yes |
| Data isolation | Dual-layer: application middleware + Sequelize default scope + PostgreSQL RLS (ADR-006) | Yes |
| Transport security | TLS via Traefik ACME (ADR-007) | Yes |
| Infrastructure security | CrowdSec with Traefik ForwardAuth bouncer (ADR-007) | Yes (baseline) |
| Password reset tokens | DB-stored hash, 1-hour expiry, single-use, all sessions invalidated on reset (ADR-002) | Yes |
| SQL injection | Sequelize ORM for standard queries, parameterized raw SQL for FTS (ADR-005 query pattern uses :sanitized_query) | Yes |

The Sentinel agent may augment with application-level rate limiting, CSRF protections beyond sameSite cookies, Content Security Policy headers, and input validation specifics. These are refinements, not gaps. The architecture provides an adequate security foundation for Commercial profile.

---

## Verdict

**PASS -- Architecture is ready for the Architecture Gate.**

All 17 requirements have architectural provision. The 9 ADRs are internally consistent with no contradictions. All 55 fitness functions trace to stated requirements or Manifest constraints. Data durability is addressed as a first-class concern with appropriate trade-offs documented. AUDIT-003 (design aesthetic) is resolved by ADR-008. ADR-007 provides fully explicit staging and production environments with separate database provisioning. No ambiguities remain that would block the Planner or Builder.

The 3 observations are informational and do not block the gate.

**Recommendation: Proceed to Architecture Gate with Nexus.**
