# Environment Contract v1
**Project:** BrainDump
**Phase:** DevOps Phase 1 -- pre-Builder setup
**Date:** 2026-03-19
**Status:** Active

This document is the interface between the DevOps agent and the Builder. The Builder programs against the variable names and purposes defined here. The DevOps agent manages actual values -- no values appear in this document.

---

## 1. Development Environment Setup

### Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose v2) installed and running
- Node.js 20 LTS installed locally (for running tests and migrations outside of Docker)
- Git

### Starting the development environment

```sh
# 1. Clone the repository (if not already done)
git clone <repo-url>
cd braindump

# 2. Copy the environment template
cp .env.example .env
# .env is pre-configured for local Compose development -- no changes needed to run locally.
# Edit SESSION_SECRET and EMAIL_FROM if desired; all other defaults work as-is.

# 3. Start all services (PostgreSQL + backend + frontend)
docker-compose -f docker-compose.dev.yml up
```

The first run builds the development images and installs dependencies. Subsequent starts are fast.

### What starts

| Service | URL | Notes |
|---|---|---|
| Frontend (Vite HMR) | http://localhost:5173 | Hot-reloads on any change to `frontend/src/` |
| Backend (nodemon) | http://localhost:3000 | Hot-reloads on any change to `backend/src/` |
| PostgreSQL 16 | localhost:5432 | Accessible with psql or any GUI client |

The backend runs migrations automatically on startup. The database schema is always up to date when the backend starts.

### Email in development

`EMAIL_PROVIDER=console` is set in `docker-compose.dev.yml`. All outgoing emails (password reset links, etc.) are printed to the backend container's stdout. No SMTP account or external service is required in development.

To see emails: `docker-compose -f docker-compose.dev.yml logs -f backend`

### Stopping and resetting

```sh
# Stop all services
docker-compose -f docker-compose.dev.yml down

# Stop and delete the database volume (full reset)
docker-compose -f docker-compose.dev.yml down -v
```

### Running tests locally

```sh
# Backend unit tests (no database required)
cd backend && npm run test:unit

# Backend integration tests (requires PostgreSQL running)
# Start postgres first: docker-compose -f docker-compose.dev.yml up -d postgres
cd backend && npm run test:integration

# Frontend tests
cd frontend && npm test
```

---

## 2. Environment Variable Reference

All variables apply to the backend server process. The frontend build has no runtime environment variables -- it communicates with the backend via `/api/*` routes at the same origin (or via the Vite proxy in development).

### Variable definitions

| Variable | Purpose | Secret | Required | Default (dev) |
|---|---|---|---|---|
| `POSTGRES_URL` | PostgreSQL connection string. Full DSN including host, port, database name, username, and password. | YES | Yes -- all environments | `postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev` (dev only) |
| `SESSION_SECRET` | Random string used by `express-session` to sign session cookies. Compromise of this value allows session forgery. | YES | Yes -- all environments | Any non-empty string (dev) |
| `NODE_ENV` | Runtime mode. Controls logging verbosity, SQL query logging (Sequelize), and error detail in HTTP responses. | No | Yes -- all environments | `development` |
| `APP_URL` | Publicly reachable base URL of the application. Used to construct password reset links in emails. Must not have a trailing slash. | No | Yes -- all environments | `http://localhost:5173` (dev) |
| `EMAIL_PROVIDER` | Selects the email backend. `console` prints to stdout. Real provider names enable actual sending. | No | Yes -- all environments | `console` |
| `EMAIL_API_KEY` | API key for the selected email provider. Ignored when `EMAIL_PROVIDER=console`. | YES | Production only | (empty) |
| `EMAIL_FROM` | Sender address in all outgoing emails. Should match a domain the email provider authorizes for sending. | No | Yes -- all environments | `noreply@example.com` (dev) |

### Builder programming contract

- Read `POSTGRES_URL` via `process.env.POSTGRES_URL`. Pass directly to the Sequelize constructor as the connection string. Do not parse it.
- Read `SESSION_SECRET` via `process.env.SESSION_SECRET`. Pass to `express-session`. Never log it.
- Check `NODE_ENV` via `process.env.NODE_ENV`. Use to gate SQL query logging and error message detail in responses.
- Read `APP_URL` via `process.env.APP_URL` when constructing any absolute URL (e.g. password reset links). Do not hardcode `localhost`.
- Read `EMAIL_PROVIDER` via `process.env.EMAIL_PROVIDER`. Branch on its value to select the email transport. The `console` case must write to stdout.
- Read `EMAIL_API_KEY` via `process.env.EMAIL_API_KEY`. Only required when `EMAIL_PROVIDER` is not `console`.
- Read `EMAIL_FROM` via `process.env.EMAIL_FROM`. Use as the `from` address on all outgoing emails.

---

## 3. CI Pipeline

### Pipeline definition

File: `.github/workflows/ci.yml`
Triggers: every push and pull request to `main`

### Jobs and sequence

```
push / PR to main
  ├── lint            (ESLint on backend and frontend)
  ├── unit-tests      (Jest -- no database required)
  ├── integration-tests  (Jest + ephemeral PostgreSQL service container)
  ├── migration-test  (fresh DB, all migrations, full test suite -- FF-D11)
  └── build-and-push  (depends on all four above)
        ├── [all branches] Build Docker image (validates image builds -- FF-D33)
        └── [push to main only] Push ghcr.io/ORG/braindump:staging
```

### Fitness functions verified by CI

| ID | Check | Where |
|---|---|---|
| FF-D01 | Build and all tests pass | `unit-tests`, `integration-tests`, `migration-test` jobs |
| FF-D11 | Migrations applied to fresh DB, full suite passes | `migration-test` job |
| FF-D32 | Pipeline completes in < 10 minutes | GitHub Actions timing (monitor via Actions tab) |
| FF-D33 | Docker image builds successfully | `build-and-push` job (build step) |

### Image push policy

- CI pushes `:staging` tag on every green build of `main`. Watchtower on nxlabs.cc picks this up for the staging environment within 5 minutes.
- CI never pushes `:latest`. The `:latest` tag is reserved for production and is applied only by the operator after Nexus approval at Demo Sign-off.
- PRs build the image but do not push, confirming the image builds without publishing untested code.

### CI database

The integration and migration test jobs use an ephemeral PostgreSQL 16 service container spun up by GitHub Actions. This database is created and destroyed with the job. It never exists outside of CI. The test credentials (`braindump_test` / `braindump_migrate`) are not secrets -- they are hardcoded in the workflow and exist only in the ephemeral CI environment.

---

## 4. Docker Image

### Build command

```sh
docker build -t ghcr.io/ORG/braindump:local .
```

### Multi-stage build

| Stage | Base | Purpose |
|---|---|---|
| `frontend-builder` | `node:20-alpine` | Runs `npm run build` in `frontend/`, producing `frontend/dist/` |
| `production` | `node:20-alpine` | Backend runtime; copies `frontend/dist/` into `public/`; runs as non-root user |

The production image contains only backend `node_modules` (production dependencies, `--omit=dev`) and the pre-built frontend assets. No build tools, no frontend `node_modules`, no source maps in the final image.

### Entrypoint behavior (FF-D43)

The entrypoint script (`docker-entrypoint.sh`) runs on every container start:

```
docker-entrypoint.sh
  1. npx sequelize-cli db:migrate   ← runs all pending Sequelize migrations
  2. exec node src/server.js        ← starts the Express server
```

If step 1 fails (migration error), the script exits non-zero. The container does not start. Watchtower does not replace the running container. The previous container continues to serve traffic. This is the rollback mechanism -- no additional tooling required.

### Exposed port

The container exposes port 3000. In production and staging, Traefik routes HTTPS traffic to this port based on the `Host()` rule in Docker labels. Port 3000 is never bound to a public interface -- it is only accessible to Traefik on the `traefik` Docker network.

### Health check

`GET /api/health`

Expected response when healthy:
```json
{ "status": "ok", "db": "connected" }
```
HTTP 200.

Expected response when unhealthy (database unreachable):
```json
{ "status": "error", "db": "disconnected" }
```
HTTP 503.

The Docker `HEALTHCHECK` instruction in the image hits this endpoint. Uptime Kuma auto-registers monitoring via the Docker label in the Compose file.

---

## 5. Staging Environment

### Deployment mechanism

CI pushes `ghcr.io/ORG/braindump:staging` on every green build of `main`. Watchtower on nxlabs.cc polls the registry every 5 minutes, detects the new image, pulls it, and performs a rolling restart of the `braindump-staging` container with zero downtime.

No deploy scripts, no SSH-in-CI, no manual steps.

### Staging environment configuration

Staging runs at `https://braindump.staging.nxlabs.cc` behind Traefik with a Let's Encrypt TLS certificate (auto-managed by Traefik ACME).

The staging database is a separate PostgreSQL user and database (`braindump_staging`) on the shared PostgreSQL 16 instance. It is provisioned once by the operator:

```sh
ssh deploy@nxlabs.cc /opt/postgres/provision.sh braindump-staging
```

The output credentials are stored in `/opt/braindump/.env.staging` on the server. This file is never committed to version control. The staging `.env` uses `EMAIL_PROVIDER=console` -- no real email is sent from staging.

The Compose file for staging lives in the repository at a location to be agreed during Phase 2. The operator copies it to `/opt/braindump/docker-compose.staging.yml` on the server. The `.env.staging` file is outside version control.

---

## 6. Production Environment

### Promotion mechanism

When the Nexus approves at Demo Sign-off, the operator promotes the staging-proven image to production:

```sh
docker tag ghcr.io/ORG/braindump:staging ghcr.io/ORG/braindump:latest
docker push ghcr.io/ORG/braindump:latest
```

Watchtower on nxlabs.cc detects the new `:latest` image and performs a rolling restart of the `braindump-prod` container within 5 minutes.

### Production environment configuration

Production runs at `https://braindump.nxlabs.cc` behind Traefik.

The production database is a separate PostgreSQL user and database (`braindump_prod`) provisioned once:

```sh
ssh deploy@nxlabs.cc /opt/postgres/provision.sh braindump-prod
```

Credentials are stored in `/opt/braindump/.env.prod` on the server. This file is never committed to version control.

---

## 7. Environment Parity

| Variable | Development | Staging | Production |
|---|---|---|---|
| `POSTGRES_URL` | Local Compose `postgres` service | Shared nxlabs.cc PostgreSQL (`braindump_staging`) | Shared nxlabs.cc PostgreSQL (`braindump_prod`) |
| `SESSION_SECRET` | Any value | Unique secret, stored in `.env.staging` | Unique secret, stored in `.env.prod` |
| `NODE_ENV` | `development` | `staging` | `production` |
| `APP_URL` | `http://localhost:5173` | `https://braindump.staging.nxlabs.cc` | `https://braindump.nxlabs.cc` |
| `EMAIL_PROVIDER` | `console` | `console` | Real provider (e.g. `sendgrid`) |
| `EMAIL_API_KEY` | (empty) | (empty) | Real API key, stored in `.env.prod` |
| `EMAIL_FROM` | `noreply@example.com` | `noreply@staging.nxlabs.cc` | `noreply@nxlabs.cc` |

### Known parity gaps

| Gap | Description | Risk | Mitigation |
|---|---|---|---|
| PostgreSQL host | Dev uses a local container; staging/production use the shared nxlabs.cc instance via `postgres` Docker network hostname | A network connectivity issue specific to the shared instance would not be caught in dev | Integration tests in CI run against a fresh PostgreSQL 16 container, matching the shared instance version |
| `NODE_ENV=staging` | Staging uses `staging` rather than `production` -- application code must treat `staging` as equivalent to `production` for behavior purposes | Application bugs could be hidden by a `NODE_ENV !== 'production'` guard | Builder must treat `staging` and `production` equivalently; do not gate production-only behavior on `NODE_ENV === 'production'` alone |
| Email sending | Dev and staging use `console`; production uses a real provider | Email delivery bugs (template errors, provider auth) are not tested until production | Staging intentionally uses `console` to avoid sending test emails to real addresses; email template correctness is tested at the application level in unit tests |

---

## 8. Secret Management

Actual secret values are never committed to version control. The management chain is:

| Environment | Where secrets live | Who manages them |
|---|---|---|
| Development | `.env` file (gitignored) on the developer's machine | Developer |
| CI | GitHub Actions secrets (`GITHUB_TOKEN` for registry push is auto-provided; no other secrets required in Phase 1) | DevOps / repository admin |
| Staging | `/opt/braindump/.env.staging` on `nxlabs.cc`, readable only by the `deploy` user | Operator (DevOps) |
| Production | `/opt/braindump/.env.prod` on `nxlabs.cc`, readable only by the `deploy` user | Operator (DevOps) |

The `.env.example` file in the repository root shows all variable names and safe placeholder values. It contains no real secrets.
