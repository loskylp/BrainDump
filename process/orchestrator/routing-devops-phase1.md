# Routing Instruction
**To:** DevOps
**Phase:** DECOMPOSITION (DevOps Phase 1 -- infrastructure setup before Builder tasks)
**Task:** Stand up CI pipeline, development environment, and produce Environment Contract v1
**Load these artifacts:**
- `process/methodologist/manifest-v1.md` (CD philosophy, infrastructure preconditions)
- `process/architect/architecture-overview-v1.md` (component map, schema migration strategy, deployment pipeline)
- `process/architect/adr/ADR-001-technology-stack.md` (Node.js, Express, React, Vite, Sequelize, Tailwind)
- `process/architect/adr/ADR-007-deployment-model.md` (Docker, nxlabs.cc, Traefik, Watchtower, ghcr.io, environment configuration)
- `process/architect/adr/ADR-003-data-persistence.md` (PostgreSQL schema, migrations, WAL mode)
- `process/architect/fitness-functions.md` (deployment fitness functions: FF-D32, FF-D33, FF-D34, FF-D43)
**Produce:**
- CI pipeline definition (GitHub Actions workflow)
- Development environment configuration (docker-compose.dev.yml or equivalent)
- `process/devops/environment-contract-v1.md` (Environment Contract)
**Return to:** Orchestrator when complete

---

## Phase 1 Scope

This is DevOps Phase 1 (of 3). The goal is to have the CI pipeline and development environment ready before any Builder task begins. The Manifest states as an infrastructure precondition: "CI pipeline passing before Builder tasks begin."

### 1. CI Pipeline (GitHub Actions)

The CI pipeline must run on every push to main and produce a deployable artifact. Based on ADR-007, the pipeline stages are:

```
Push to main
  |-- Lint (ESLint for JS/TS)
  |-- Unit tests (frontend + backend)
  |-- Integration tests (against test PostgreSQL in CI)
  |-- Migration test (fresh DB + full migration + test suite)
  |-- Build Docker image
  |-- Push ghcr.io/<org>/braindump:staging
```

**Fitness function targets for the pipeline:**
- FF-D32: CI pipeline completes in < 10 minutes
- FF-D33: Docker image builds and starts within 5 seconds
- FF-D34: Health check returns 200 after container start
- FF-D43: Entrypoint script runs migrations before starting application server

**CI must include a PostgreSQL service container** for integration tests and migration tests. The test database is ephemeral (created and destroyed in CI, not on nxlabs.cc).

**Image push:** CI pushes to `ghcr.io/<org>/braindump:staging` on every green build. The `:latest` tag is NEVER pushed by CI -- it is reserved for production promotion by the operator after Nexus approval.

### 2. Development Environment

The development environment must allow a developer to run BrainDump locally with a single command. This includes:
- Local PostgreSQL (via Docker Compose or similar)
- Hot-reload for both backend (nodemon or equivalent) and frontend (Vite dev server)
- Development seed data (optional but recommended)
- Console-mode email service (no real email sending in dev)

**Environment variables for development** (based on ADR-007):
- `POSTGRES_URL` -- local PostgreSQL connection string
- `SESSION_SECRET` -- any value for local dev
- `NODE_ENV=development`
- `EMAIL_PROVIDER=console`
- `APP_URL=http://localhost:3000` (or whatever port the dev server uses)

### 3. Environment Contract

Document the following in `process/devops/environment-contract-v1.md`:
- How to set up and run the development environment
- CI pipeline description and what it validates
- Environment variable reference (all variables, their purpose, required/optional)
- Docker image build process
- Entrypoint script behavior (migration-then-start)
- How staging deployment works (CI pushes :staging tag, Watchtower picks up)
- How production deployment works (operator re-tags :staging as :latest after Nexus approval)
- Database provisioning procedure (reference to ADR-007's provision.sh)

### 4. Docker Image

The Docker image must:
- Build the full application (frontend + backend)
- Include an entrypoint script that runs `npx sequelize-cli db:migrate` before `node server.js`
- Expose port 3000
- Be multi-stage if appropriate (build stage for frontend, runtime stage for serving)
- Work with the environment variables defined in ADR-007

---

## What NOT to Do in Phase 1

- Do NOT provision databases on nxlabs.cc yet (that is Phase 2/3 -- staging and production environments)
- Do NOT deploy to nxlabs.cc yet (no application code exists to deploy)
- Do NOT create the Docker Compose files for staging/production on the server (Phase 2/3)
- Do NOT set up monitoring or fitness function instrumentation (Phase 3)

Phase 1 deliverables are: the CI pipeline definition, the local development environment, and the Environment Contract documentation.

---

## Coordination Note

The Planner is working in parallel on the Task Plan. DevOps Phase 1 output does not depend on the Task Plan, and the Task Plan does not depend on DevOps Phase 1 output. Both must complete before the first Builder task can be dispatched.

After Phase 1 is complete:
- Phase 2 (staging environment, CD pipeline to staging) triggers after the first Builder task passes Verifier
- Phase 3 (production environment, monitoring, rollback verification) triggers before the Go-Live gate
