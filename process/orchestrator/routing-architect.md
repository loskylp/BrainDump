# Routing Instruction
**To:** Architect
**Phase:** DECOMPOSITION
**Task:** Produce Architecture Overview v1 and ADRs for BrainDump
**Load these artifacts:**
- `process/methodologist/manifest-v1.md` (profile, infrastructure preconditions, CD philosophy)
- `process/analyst/brief-v2.md` (domain model, ground truths, delivery channel, scope boundaries)
- `process/analyst/requirements-v2.md` (all 17 requirements with acceptance scenarios)
- `process/auditor/audit-requirements-v2.md` (AUDIT-003 deferral, observations)
**Produce:**
- `process/architect/architecture-v1.md` (Architecture Overview)
- `process/architect/adrs/` (ADR directory with lightweight decision records)
**Return to:** Orchestrator when complete

---

## Hard Constraints (Nexus-decided -- not Architect choices)

These are not open decisions. They are settled constraints from the Nexus:

1. **PostgreSQL** is the database. The Architect designs around PostgreSQL -- the choice of database is not open. PostgreSQL provides relational integrity, full-text search indexing (FTS), and data durability.

2. **Monolithic server architecture.** The backend is a single deployable unit managing business logic and referential integrity. No microservices, no serverless decomposition.

3. **Three-panel UI layout.** The workspace is a three-panel web interface: note catalog sidebar (left), Markdown source editor with syntax highlighting (center), and live CommonMark-rendered preview (right). This is a ground truth from the Brief, not an Architect decision.

## Key Architectural Concerns

The Architect must address each of these in the Architecture Overview:

### 1. Data Durability (first-class concern)
The Methodologist and Nexus have flagged this as paramount. Users rely on BrainDump to preserve their knowledge. The architecture must address:
- PostgreSQL schema design with referential integrity (foreign keys between users, notes, versions, folders)
- Backup strategy that is documented and testable (REQ-012 acceptance scenario)
- Auto-save persistence mechanism (REQ-015: short debounce, working state only)
- Version creation mechanism (REQ-016: 30-second idle timer + any-change diff check, separate from auto-save)
- Account deletion cascade (REQ-014: permanent removal of all user data)

### 2. Auto-save and Versioning Architecture
REQ-015 (auto-save) and REQ-016 (version history) are explicitly non-overlapping mechanisms with distinct timers:
- Auto-save: short debounce timer, persists current working state, does NOT create version entries
- Version creation: 30-second idle timer, creates a snapshot ONLY when content has changed since last version
- The Architect should clarify how these two timers interact at the system level -- client-side vs. server-side, API design, and database write patterns

### 3. Full-Text Search
REQ-010 requires PostgreSQL full-text search (FTS) covering both note title and body fields. The Architect should specify the indexing strategy (tsvector columns, GIN indexes, search ranking approach).

### 4. Authentication and Session Management
REQ-001 through REQ-003 cover registration, login/logout, and password reset. The Architect should specify the authentication approach (session-based vs. token-based), password hashing strategy, and the email integration boundary for password reset.

### 5. Per-User Data Isolation
REQ-011 requires strict data isolation. The Architect should specify the enforcement mechanism (application-level, database-level, or both).

### 6. Technology Stack Selection
Within the constraints of PostgreSQL and monolithic server, the Architect decides:
- Backend language and framework
- Frontend framework or approach (must support the three-panel layout with live Markdown rendering)
- CommonMark parsing and rendering library
- Syntax highlighting library for the editor
- ORM or database access layer
- Any additional infrastructure components

### 7. Professional/Technical Design Aesthetic (AUDIT-003)
The Auditor deferred AUDIT-003: the professional/technical design aesthetic is a cross-cutting concern stated in the Brief's Ground Truths but not captured as a standalone requirement. It is referenced in REQ-007 (editor) and REQ-017 (landing page) but not in REQ-008 (catalog) or REQ-010 (search results).

The Architect must address this at the Architecture Gate. Options include:
- Providing design guidance in the Architecture Overview (color palette, typography, spacing principles) that the Builder follows
- Recommending a component library or CSS framework that enforces the aesthetic
- Documenting the aesthetic as an ADR with concrete criteria

### 8. Deployment Model
The Manifest specifies Continuous Delivery (deploy at Demo Sign-off when Nexus approves). The Architect should specify:
- Target deployment environment (cloud provider, container strategy, or other)
- How the monolith is packaged and deployed
- Database migration strategy

### 9. Responsive Design Strategy
REQ-013 requires the three-panel layout to degrade gracefully on narrow viewports (down to 375px). The Architect should acknowledge how the UI framework or approach supports this.

---

## Scope Reminders

**In scope for this architecture:**
- All 17 requirements (12 Must Have, 5 Should Have)
- The delivery channel is Web Application
- Adjacent systems to address: email service (password reset boundary), backup infrastructure

**Out of scope:**
- Payment/billing, real-time collaboration, native mobile apps, import/export, admin dashboard, nested folders, offline editing

---

## Handoff Expectations

After the Architect completes:
- The Orchestrator will route to the Auditor for an architectural audit (Commercial profile)
- After Auditor PASS, the Architecture Gate briefing goes to the Nexus
- After Nexus approval, the Orchestrator routes to the Planner (Designer is skipped per Manifest)
- DevOps Phase 1 (CI pipeline, dev environment, Environment Contract) will follow once the technology stack is known
