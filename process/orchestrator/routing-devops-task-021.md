# Routing Instruction
**To:** DevOps
**Phase:** CYCLE 2 EXECUTION (DevOps Phase 2 -- staging environment and CD pipeline formalization)
**Task:** TASK-021: DevOps Phase 2 -- staging environment and CD pipeline
**Load these artifacts:**
- `process/methodologist/manifest-v3.md` (current Manifest, CD philosophy, infrastructure preconditions)
- `process/architect/architecture-overview-v1.md` (component map, deployment pipeline)
- `process/architect/adr/ADR-007-deployment-model.md` (Docker, nxlabs.cc, Traefik, Watchtower, ghcr.io, environment configuration)
- `process/devops/environment-contract-v1.md` (Phase 1 Environment Contract -- baseline)
- `process/planner/task-plan-v2.md` (TASK-021 acceptance criteria)
- `.github/workflows/ci.yml` (current CI pipeline)
- `docker-compose.staging.yml` or equivalent staging Docker Compose (if exists on server)
- `Dockerfile` (current Docker image definition)
- `backend/docker-entrypoint.sh` or equivalent entrypoint script
**Produce:**
- Updated or confirmed CD pipeline configuration
- Deployment runbook at `process/devops/deployment-runbook.md`
- Updated Environment Contract if changes are made
- CI fix for OBS-V004-05 (acceptance test serial execution)
**Return to:** Orchestrator when complete

---

## TASK-021 Scope

This is DevOps Phase 2 (of 3). The staging environment is already operational at https://braindump.staging.nxlabs.cc (confirmed during Cycle 1 and all Cycle 2 verifications). This task formalizes the CD pipeline, resolves a known CI observation, and ensures infrastructure documentation is complete.

### 1. CD Pipeline Review and Formalization

The current flow is: CI builds and pushes `ghcr.io/loskylp/braindump:staging` on every green build to main. Watchtower on nxlabs.cc pulls new images and performs rolling restarts. Review this flow for gaps:

- Confirm Watchtower polling interval and restart behavior are appropriate
- Confirm the CI workflow correctly gates image push on all test jobs passing
- Confirm the `:staging` tag is correctly applied and pushed
- Confirm no `:latest` tag is pushed by CI (reserved for production promotion)
- Document any gaps found and fix them

### 2. Infrastructure Review and Documentation

Review and document the current nxlabs.cc staging setup. Produce a deployment runbook at `process/devops/deployment-runbook.md` covering:

- Server access and SSH configuration
- Docker Compose configuration for staging (`docker-compose.staging.yml` location and structure)
- Traefik integration (Docker labels, routing rules for `braindump.staging.nxlabs.cc`)
- Watchtower configuration (polling interval, scope, restart policy)
- PostgreSQL setup (shared instance, database provisioning via `provision.sh`)
- Environment variables (`.env.staging` or equivalent)
- Migration execution (currently via docker-compose entrypoint -- verify this is correct and document)
- How to manually deploy, rollback, and check logs
- Health check endpoint and how to verify staging is healthy

### 3. Fix OBS-V004-05: Intermittent Test Timeouts

**Source:** Verifier (TASK-004), confirmed in OBS-V007-01 (TASK-007).
**Problem:** Acceptance tests exhibit intermittent timeouts when Jest runs tests in parallel against the live PostgreSQL session store. Tests pass reliably under `--runInBand`.
**Action:** Configure the CI workflow so that acceptance tests run with `--runInBand` (serial execution). This applies to the acceptance test job/step in `.github/workflows/ci.yml`. Unit tests can continue to run in parallel.

### 4. Uptime Kuma Integration

Verify whether Uptime Kuma monitoring is already configured for the staging health endpoint. If not:

- Add Docker labels for Uptime Kuma auto-registration (per the nxlabs.cc standard pattern)
- Or manually register the health check URL in Uptime Kuma if auto-registration is not available
- Document the monitoring setup in the deployment runbook

### 5. Migration Verification

The current setup runs migrations via the Docker entrypoint script before starting the application server. Verify:

- Migrations run successfully on container startup (not just first deploy)
- Idempotent behavior: running migrations on an already-migrated database is a no-op
- Migration failures prevent the application from starting (fail-fast)
- Document this behavior in the deployment runbook

---

## Acceptance Criteria (from Task Plan v2)

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

## What NOT to Do in Phase 2

- Do NOT provision or configure the production environment (that is Phase 3, before Go-Live)
- Do NOT set up production monitoring or fitness function instrumentation (Phase 3)
- Do NOT change application code -- this is infrastructure and pipeline work only

---

## After Completion

On return to the Orchestrator:
1. The Verifier will be invoked immediately to verify TASK-021 (mode: Initial verification -- infrastructure verification against the 8 AC)
2. After Verifier PASS, the next task is TASK-018 (Responsive design, Builder)
