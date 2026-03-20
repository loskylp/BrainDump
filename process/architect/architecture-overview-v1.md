# Architecture Overview -- BrainDump
**Version:** 1 | **Date:** 2026-03-19 | **Profile:** Commercial/Draft

---

## System Metaphor

BrainDump is a personal library with a card catalog -- each user has their own locked room containing their notes, organized in labeled drawers (folders), with a librarian's index card system (full-text search) for fast retrieval. The librarian automatically stamps each card's revision history as the writer pauses between editing sessions.

The system is a monolithic server-rendered web application backed by PostgreSQL. The frontend is a single-page application shell served by the backend, providing a three-panel workspace: catalog sidebar, Markdown source editor, and live CommonMark preview.

---

## Hard Constraints (Nexus-decided)

These are not architectural decisions -- they are inputs the architecture works within:

1. **PostgreSQL** is the database engine
2. **Monolithic server architecture** -- single deployable backend unit
3. **Three-panel UI** -- catalog sidebar + editor panel + live preview panel

---

## Key Decisions

Each decision below is recorded as a separate ADR in `process/architect/adr/`. This section provides a navigable summary.

### ADR-001: Technology Stack
**Chosen:** Node.js with Express, Sequelize ORM, React frontend with CodeMirror 6 editor and markdown-it renderer
**Why:** Node.js provides a unified JavaScript stack for both server and client, reducing context switching. Express is mature and well-suited for monolithic web applications. React handles the three-panel interactive workspace efficiently. CodeMirror 6 provides production-grade Markdown syntax highlighting. markdown-it is CommonMark-compliant and fast enough for keystroke-level re-rendering. Sequelize provides migration-based schema evolution for PostgreSQL.
**ADR:** [ADR-001-technology-stack.md](adr/ADR-001-technology-stack.md)

### ADR-002: Authentication and Session Management
**Chosen:** Server-side sessions with express-session backed by PostgreSQL (connect-pg-simple), bcrypt password hashing, token-based password reset via email
**Why:** Session-based auth is simpler than JWT for a server-rendered monolith where the server already manages state. PostgreSQL-backed sessions survive server restarts. bcrypt provides adaptive hashing that remains secure as hardware improves.
**ADR:** [ADR-002-authentication-sessions.md](adr/ADR-002-authentication-sessions.md)

### ADR-003: Data Persistence and Schema Design
**Chosen:** Five-table relational schema (users, notes, note_versions, folders, sessions) with foreign key cascades, WAL-mode PostgreSQL. Backups are the shared PostgreSQL infrastructure's responsibility (not BrainDump's).
**Why:** Referential integrity at the database level prevents orphaned records. CASCADE deletes on user removal satisfy REQ-014 atomically. WAL mode addresses data durability as a first-class concern. Backup strategy is delegated to the nxlabs.cc shared PostgreSQL instance operator -- BrainDump verifies backup health via Uptime Kuma rather than running its own pg_dump.
**ADR:** [ADR-003-data-persistence.md](adr/ADR-003-data-persistence.md)

### ADR-004: Auto-save and Versioning Architecture
**Chosen:** Client-side debounce (2-second) triggers auto-save API call; client-side 30-second idle timer triggers separate version-check API call; server performs diff and conditionally creates version
**Why:** Two distinct timers on the client map directly to the two non-overlapping mechanisms defined in REQ-015/REQ-016. Server-side diff check ensures version creation is authoritative regardless of client behavior. Auto-save updates the note row directly; version creation inserts into note_versions only when content differs.
**ADR:** [ADR-004-autosave-versioning.md](adr/ADR-004-autosave-versioning.md)

### ADR-005: Full-text Search via PostgreSQL FTS
**Chosen:** Maintained tsvector column on notes table with GIN index, combined title (weight A) and body (weight B) vectors, ts_rank for relevance ordering
**Why:** PostgreSQL FTS is a hard constraint from the requirements. Weighted vectors ensure title matches rank higher than body matches -- matching Carla's search-by-keyword workflow. GIN index provides sub-linear search time as note collections grow.
**ADR:** [ADR-005-fulltext-search.md](adr/ADR-005-fulltext-search.md)

### ADR-006: Per-user Data Isolation
**Chosen:** Application-level enforcement via middleware that injects user_id into every query, plus database-level CHECK-like enforcement via Row-Level Security (RLS) policies as a defense-in-depth layer
**Why:** Application-level filtering is the primary mechanism -- straightforward and testable. RLS provides a second line of defense: even if a code path bypasses the middleware, the database itself rejects cross-user access. Belt and suspenders for a first-class security concern.
**ADR:** [ADR-006-data-isolation.md](adr/ADR-006-data-isolation.md)

### ADR-007: Deployment Model
**Chosen:** Two containers on nxlabs.cc (production + staging), each with its own provisioned database on the shared PostgreSQL 16 instance. Integrates with shared infrastructure: Traefik v3 reverse proxy (TLS via ACME), Watchtower for zero-downtime auto-updates, Uptime Kuma for monitoring, CrowdSec for security. No Nginx, no BrainDump-owned PostgreSQL container, no deploy scripts. CI pushes `:staging` tag; operator promotes to `:latest` for production after Nexus approval.
**Why:** The Nexus has designated nxlabs.cc as the target server with pre-existing shared services. BrainDump deploys as Docker containers that join the `traefik` and `postgres` networks, declared entirely via Docker labels. Staging and production are fully isolated (separate databases, separate credentials, separate image tags). Watchtower polls for image updates and performs rolling restarts -- deployment is push-to-registry, not SSH-and-script.
**ADR:** [ADR-007-deployment-model.md](adr/ADR-007-deployment-model.md)

### ADR-008: Professional/Technical Design Aesthetic (AUDIT-003)
**Chosen:** Tailwind CSS utility framework with a constrained design token system -- neutral color palette, monospace accents for code contexts, system font stack for prose, 4px spacing grid, minimal decorative elements
**Why:** The professional/technical aesthetic is a cross-cutting concern (AUDIT-003) that must be enforced consistently across all UI surfaces. Tailwind with a locked configuration file provides the constraint mechanism -- the Builder works within a defined palette and spacing system rather than making ad-hoc visual decisions. This resolves AUDIT-003 without requiring a Designer agent.
**ADR:** [ADR-008-design-aesthetic.md](adr/ADR-008-design-aesthetic.md)

### ADR-009: Responsive Design Strategy
**Chosen:** Progressive collapse pattern -- three panels at >=1024px, two panels (collapsible sidebar) at 768-1023px, single panel with navigation drawer at <768px; CSS Grid for layout, media query breakpoints
**Why:** The three-panel layout cannot fit on narrow viewports without becoming unusable. Progressive collapse preserves the information hierarchy while adapting to available space. CSS Grid provides native responsive layout without JavaScript layout calculations.
**ADR:** [ADR-009-responsive-design.md](adr/ADR-009-responsive-design.md)

---

## Schema Migration Strategy

Schema migrations are managed by Sequelize CLI (`sequelize-cli`). Each migration is a versioned, timestamped file that runs forward (up) or backward (down).

- **Zero-downtime pattern:** Watchtower performs rolling restarts -- the old container serves traffic until the new one is healthy. Migrations run as the first step in the Docker image entrypoint script, before the application server starts. If migrations fail, the container exits and Watchtower leaves the previous container running.
- **Rollback procedure:** Every migration must include a `down` method. Rollback is `sequelize db:migrate:undo`. Because Watchtower only replaces the old container when the new one starts successfully, a failed migration means the previous container continues serving. To manually roll back, revert the image tag.
- **Migration testing:** Migrations run against a test database in CI before deployment. The CI pipeline applies all migrations to a fresh database, then runs the test suite.
- **Shared database caveat:** Migrations run against the shared PostgreSQL instance on nxlabs.cc. Destructive migrations (column drops, table drops) must be backward-compatible or coordinated with a maintenance window, because the old container may still be running during the migration window.

---

## Component Map

```
braindump/
  client/                    # React SPA
    src/
      components/
        Sidebar/             # Note catalog (REQ-008), folder tree (REQ-009)
        Editor/              # CodeMirror 6 Markdown editor (REQ-007 left panel)
        Preview/             # markdown-it live renderer (REQ-007 right panel)
        Auth/                # Login, Register, Password Reset forms
        Landing/             # Public landing page (REQ-017)
        VersionHistory/      # Version list and restore UI (REQ-016)
      hooks/
        useAutoSave.js       # 2-second debounce auto-save logic (REQ-015)
        useVersionTimer.js   # 30-second idle version trigger (REQ-016)

  server/                    # Express monolith
    routes/
      auth.js               # Registration, login, logout, password reset
      notes.js               # CRUD, auto-save, search
      versions.js            # Version history, restore
      folders.js             # Folder CRUD, note assignment
    middleware/
      authenticate.js        # Session validation
      ownershipGuard.js      # Per-user data isolation (REQ-011)
    models/                  # Sequelize models
    migrations/              # Sequelize migrations
    services/
      searchService.js       # FTS query builder
      versionService.js      # Diff check + version creation
      emailService.js        # Password reset email (integration boundary)
```

### Resource Topology

| Component | Resource | Operations |
|---|---|---|
| Auth routes | User, Session | Create (register), read (login status), update (password reset), delete (logout, account deletion) |
| Notes routes | Note | Create, read, update (auto-save), delete, search (FTS) |
| Versions routes | Note Version | Read (list, view), create (restore triggers new version) |
| Folders routes | Folder | Create, read, update (rename), delete; assign/unassign notes |

---

## Adjacent Systems

| System | Integration | Boundary |
|---|---|---|
| Email service | Password reset tokens (REQ-003) | The application generates a signed, time-limited reset token and passes it to an email sending service. The email service is an external dependency -- the application defines the interface (send email with subject, body, recipient) but does not implement SMTP delivery. In development, emails are logged to console. In production, a transactional email provider (e.g., SendGrid, Postmark, or self-hosted SMTP) is configured via environment variable. |
| Shared PostgreSQL infrastructure | Database hosting, backups (REQ-012) | BrainDump uses the shared PostgreSQL 16 instance on nxlabs.cc, with separate databases provisioned per environment (`braindump_prod` via `provision.sh braindump-prod`, `braindump_staging` via `provision.sh braindump-staging`). Backup responsibility is delegated to the nxlabs infrastructure team. BrainDump does not run or monitor backups. Durability SLA is dependent on nxlabs team's backup policy. |

---

## Deferred Decisions

| Decision | Why deferred | Trigger to revisit |
|---|---|---|
| Note export format | Out of scope for v1 per Brief | If export feature is added in a future cycle |
| Application-level rate limiting | CrowdSec provides server-level rate limiting on nxlabs.cc; application-level rate limiting may still be needed for API-specific abuse patterns | Sentinel security review or abuse observed despite CrowdSec |
| CDN for static assets | Single-server deployment is sufficient for current scale | If response times from distant locations become a concern |
| WebSocket for real-time sync | No collaboration feature in v1 | If real-time collaboration is added |
| Database connection pooling tuning | Default pool settings sufficient for 5-50 concurrent users | If connection saturation is observed in production monitoring |

---

## Fitness Functions Summary

See [fitness-functions.md](fitness-functions.md) for the complete index. Key thresholds:

| Characteristic | Dev check | Prod threshold |
|---|---|---|
| Data durability | Integration test: write, restart, read-back | Backup delegated to nxlabs infra team; BrainDump does not run or monitor backups |
| Auth security | Test suite: protected routes reject unauthenticated requests; no user enumeration on reset | Monitor 401 spike >5x baseline |
| Data isolation | Test suite: cross-user access returns 403/404 | Log and alert on any RLS policy violation |
| Search performance | Test: 200-note collection returns results < 200ms | p95 search query < 500ms |
| Auto-save reliability | Test: content persisted after debounce; no version created | Save error rate < 0.1% |
| Editor responsiveness | Test: preview renders within 100ms of edit | No prod threshold (client-side) |
| Page load | Lighthouse CI: LCP < 2.5s | Monitor LCP in RUM; warn > 3s |

---

## Handoff Notes

**For the Planner:**
- Each ADR contains fitness functions that must become instrumentation tasks in the task plan
- The component map above defines the module boundaries -- if 3+ Builder tasks are planned per cycle, the Scaffolder should use this map to set up the project skeleton
- The email service integration boundary is deliberately thin -- the Builder implements a service interface; the actual provider is configured at deploy time
- Auto-save and versioning are the most architecturally complex features -- they should be planned together or sequentially, not in parallel with unrelated work, because they share the note update path

**For the Builder (on-call context):**
- If any question arises about whether something is an auto-save concern or a versioning concern, the answer is in ADR-004: auto-save updates the `notes` row, versioning inserts into `note_versions`. They never overlap.
- The design aesthetic constraints in ADR-008 are the source of truth for visual decisions. When in doubt, favor restraint -- fewer colors, more whitespace, monospace where technical content appears.
