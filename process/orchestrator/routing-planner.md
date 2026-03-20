# Routing Instruction
**To:** Planner
**Phase:** DECOMPOSITION
**Task:** Produce Task Plan v1 using the three-pass sequence (decomposition, scoring, release map)
**Load these artifacts:**
- `process/methodologist/manifest-v1.md` (iteration model, CD philosophy, gate configuration)
- `process/analyst/brief-v2.md` (domain model, personas, scope boundaries)
- `process/analyst/requirements-v2.md` (17 requirements with 68 acceptance scenarios)
- `process/architect/architecture-overview-v1.md` (component map, schema, adjacent systems, handoff notes)
- `process/architect/adr/` (all 9 ADRs -- especially ADR-004 auto-save/versioning, ADR-005 FTS, ADR-006 data isolation, ADR-007 deployment, ADR-008 design aesthetic)
- `process/architect/fitness-functions.md` (55 fitness functions that must become instrumentation tasks)
- `process/auditor/audit-architecture-v1.md` (observations OBS-001 through OBS-003)
**Produce:**
- `process/planner/task-plan-v1.md` (Task Plan with all three passes)
**Return to:** Orchestrator when complete

---

## Three-Pass Sequence

### Pass 1: Decomposition
Decompose the 17 requirements into atomic Builder tasks with acceptance criteria. Each task must be:
- Small enough to complete in a single Builder invocation
- Independently verifiable (the Verifier can confirm pass/fail)
- Traced to one or more REQ-NNN

Include dependency edges between tasks (which tasks must complete before others can start).

### Pass 2: Scoring and Ordering
Apply risk/value rubrics to each task. Determine:
- Priority matrix (risk vs. value)
- Walking skeleton identification (the minimal end-to-end path through the system)
- Cut line (Must Have tasks that form the MVP boundary vs. Should Have tasks)

### Pass 3: Release Map
Group tasks into demonstrable cycles. Each cycle must:
- End with a working, demonstrable increment
- Respect dependency ordering
- Include a rolling confidence assessment
- Identify unplaced requirements (if any)

---

## Key Inputs for Task Decomposition

### Technology Stack (decided at Architecture Gate)
- **Backend:** Node.js + Express + Sequelize ORM
- **Frontend:** React + Vite + CodeMirror 6 (editor) + markdown-it (renderer) + Tailwind CSS
- **Database:** PostgreSQL 16 (shared instance on nxlabs.cc)
- **Deployment:** Docker on nxlabs.cc, Traefik reverse proxy, Watchtower auto-updates
- **Image registry:** ghcr.io
- **Environments:** braindump-prod (braindump.nxlabs.cc) + braindump-staging (braindump.staging.nxlabs.cc)

### Architectural Guidance for Task Ordering
From the Architect's handoff notes:
1. **Auto-save (REQ-015) and versioning (REQ-016) should be planned together or sequentially** -- they share the note update path. Do not plan them in parallel with unrelated work.
2. **Each ADR contains fitness functions that must become instrumentation tasks** -- see `process/architect/fitness-functions.md` for the full list of 55 fitness functions (42 dev-side, 13 prod-side with 2 N/A).
3. **The component map defines module boundaries** -- if 3+ Builder tasks are in a cycle, the Scaffolder sets up the project skeleton first.
4. **The email service integration boundary is deliberately thin** -- the Builder implements a service interface; the actual provider is configured at deploy time.

### Flagged Items for Task Inclusion

**OBS-002 (from Auditor -- MUST be a task):** The migration/administrative database role must bypass RLS (ADR-006 uses FORCE ROW LEVEL SECURITY). The provisioned database users (braindump_prod, braindump_staging) need role separation: the application connects as a role subject to RLS, while migrations run as a privileged role or with explicit RLS exemption. This is an implementation task, not just a note -- the Builder must configure this during database setup.

**OBS-001 (informational):** REQ-012 acceptance scenario 2 (backup verification) is an infrastructure acceptance test owned by the nxlabs team. It is not testable by BrainDump's own test suite. The Planner should note this in the task plan so the Verifier knows to handle it as an infrastructure verification, not a code test.

**OBS-003 (resolved):** REQ-015's auto-save debounce is now specified as 2 seconds (ADR-004). The Builder has a concrete value.

### DevOps Task Phasing
DevOps tasks should be tagged by phase so the Orchestrator can enforce sequencing:
- **Phase 1** (before any Builder task): CI pipeline, dev environment, Environment Contract -- being handled by DevOps in parallel with this planning work
- **Phase 2** (after first Builder task passes Verifier): staging environment, CD pipeline to staging
- **Phase 3** (before Go-Live gate): production environment, monitoring, fitness function instrumentation, rollback verification

### Walking Skeleton Candidates
The walking skeleton should demonstrate the thinnest possible end-to-end path. Consider:
- User registers, logs in, creates a note, types Markdown, sees live preview, note is persisted in PostgreSQL, user logs out
- This touches: REQ-001, REQ-002, REQ-004, REQ-005, REQ-007, REQ-012, REQ-015

### Cycle Constraints
- Each cycle ends with a Demo Sign-off (Manifest)
- CD philosophy: Continuous Delivery -- deploy at Demo Sign-off when Nexus approves
- Max iterations per task: 3
- Convergence signal: 2 consecutive non-decreasing failure counts triggers escalation
