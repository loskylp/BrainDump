# Deployment Runbook
**Project:** BrainDump
**Date:** 2026-03-21
**Status:** Active
**ADR:** ADR-007 (Deployment Model)

---

## 1. Infrastructure Overview

BrainDump runs on `nxlabs.cc` (187.124.233.130) as a single Docker container managed by Docker Compose. It integrates with shared infrastructure services already running on the server -- BrainDump does not provision or manage these services.

| Shared service | Purpose | How BrainDump uses it |
|---|---|---|
| Traefik v3 | Reverse proxy, TLS termination | Docker labels on the container; Traefik auto-discovers routing rules |
| PostgreSQL 16 | Database | `postgres` Docker network hostname; connection string in `.env.staging` / `.env.prod` |
| Watchtower | Auto-pulls new images and rolling restart | `com.centurylinklabs.watchtower.enable=true` Docker label |
| AutoKuma + Uptime Kuma | Uptime monitoring at https://status.nxlabs.cc | `kuma.*` Docker labels; AutoKuma auto-registers monitors |
| CrowdSec + bouncer | IP-level rate limiting, bot detection | Server-level; no application configuration required |

### Environments

| Environment | URL | Image tag | Compose file | DB |
|---|---|---|---|---|
| Staging | https://braindump.staging.nxlabs.cc | `ghcr.io/loskylp/braindump:staging` | `/opt/braindump/docker-compose.staging.yml` | `braindump` on shared PostgreSQL |
| Production | https://braindump.nxlabs.cc | `ghcr.io/loskylp/braindump:latest` | `/opt/braindump/docker-compose.prod.yml` | `braindump_prod` on shared PostgreSQL (not yet provisioned -- Phase 3) |

**Parity note:** The staging database was provisioned as `braindump` / `braindump` (deviation from ADR-007 which specifies `braindump_staging` / `braindump_staging`). The database is in production use for staging and will not be renamed. This gap is documented here. Production will use the correct naming (`braindump_prod`).

---

## 2. Server Access

```sh
ssh deploy@nxlabs.cc
```

SSH key authentication only. Root login is disabled. The `deploy` user has Docker access.

Files live at `/opt/braindump/`:
```
/opt/braindump/
  docker-compose.staging.yml   # staging Compose file (version-controlled in repo)
  .env.staging                 # staging secrets (not version-controlled, never commit)
  docker-compose.prod.yml      # production Compose file (Phase 3)
  .env.prod                    # production secrets (Phase 3, not version-controlled)
```

---

## 3. How Deployments Work (Automatic)

The full automatic flow on every push to `main`:

```
Developer pushes to main
    |
    v
GitHub Actions CI (approx 5-8 minutes)
    |-- lint                    (ESLint backend + frontend)
    |-- unit-tests              (Jest unit, no DB)
    |-- integration-tests       (Jest integration, ephemeral PostgreSQL)
    |-- migration-test          (fresh DB + all migrations + full test suite, --runInBand)
    |-- build-and-push          (depends on all 4 above)
         |-- Build Docker image
         |-- Push ghcr.io/loskylp/braindump:staging to GitHub Container Registry
    |
    v
Watchtower on nxlabs.cc (polls every 5 minutes)
    |-- Detects new :staging image digest
    |-- Pulls new image
    |-- Stops old container (SIGTERM, 30s grace period)
    |-- Starts new container
    |-- New container runs docker-entrypoint.sh:
    |       1. npx sequelize-cli db:migrate  (idempotent -- no-op if up to date)
    |       2. exec node src/server.js
    |-- Docker HEALTHCHECK confirms healthy (10s interval, 15s start period)
    |-- AutoKuma auto-registers health monitor in Uptime Kuma (if not already registered)
```

**Total time from push to staging deploy:** approximately 10-15 minutes (5-8 min CI + up to 5 min Watchtower polling).

**Image push policy:** CI only pushes `:staging`. The `:latest` tag is reserved for production and is applied manually by the operator after Nexus Demo Sign-off approval.

---

## 4. How to Manually Trigger a Redeployment

Watchtower only redeploys when the image digest changes. If you need to force a redeploy without a code change:

**Option A -- Force pull and restart (no new image needed):**
```sh
ssh deploy@nxlabs.cc
cd /opt/braindump
docker compose -f docker-compose.staging.yml pull
docker compose -f docker-compose.staging.yml up -d
```

**Option B -- Push an empty commit to trigger CI:**
```sh
git commit --allow-empty -m "chore: force CI redeploy"
git push
```
CI will build and push a new image; Watchtower picks it up within 5 minutes.

**Option C -- Restart the existing container without pulling:**
```sh
ssh deploy@nxlabs.cc
docker restart braindump-braindump-staging-1
```
Use this to restart the app without deploying a new image (e.g., after an env var change).

---

## 5. How to Check Staging Logs

```sh
ssh deploy@nxlabs.cc

# Live log stream
docker logs braindump-braindump-staging-1 -f

# Last 100 lines
docker logs braindump-braindump-staging-1 --tail 100

# Filter for migration output
docker logs braindump-braindump-staging-1 2>&1 | grep -E '(entrypoint|migration|Migrations)'

# Check Watchtower activity (recent image pulls and restarts)
docker logs watchtower --tail 50

# Check AutoKuma activity (Uptime Kuma monitor registration)
docker logs autokuma --tail 50
```

---

## 6. How to Verify Staging is Healthy

```sh
# Health check endpoint (returns 200 + JSON when healthy)
curl -s https://braindump.staging.nxlabs.cc/api/health
# Expected: {"status":"ok","db":"connected"}

# Container status
ssh deploy@nxlabs.cc "docker ps --filter name=braindump-staging --format 'table {{.Names}}\t{{.Status}}'"
# Expected: Up N minutes (healthy)

# Uptime Kuma dashboard
# https://status.nxlabs.cc (check for "BrainDump Staging" monitor)
```

---

## 7. How to Roll Back

Watchtower's rollback mechanism is passive: if the new container fails to start (migration failure, crash on startup), Watchtower does not replace the running container. The previous container continues serving traffic.

**Manual rollback to a specific previous image:**

GitHub Container Registry keeps previous image versions. To roll back:

```sh
# On the deployment machine (not the server -- needs Docker auth):
docker pull ghcr.io/loskylp/braindump:staging@<previous-digest>
docker tag ghcr.io/loskylp/braindump:staging@<previous-digest> ghcr.io/loskylp/braindump:staging
docker push ghcr.io/loskylp/braindump:staging
```

Watchtower will detect the restored digest and restart the container within 5 minutes.

**Emergency manual rollback on the server:**

```sh
ssh deploy@nxlabs.cc
cd /opt/braindump

# Pull the previous image (if still in local cache)
docker images ghcr.io/loskylp/braindump --format "table {{.Tag}}\t{{.ID}}\t{{.CreatedAt}}"

# Run a specific image SHA directly
docker compose -f docker-compose.staging.yml down
docker run -d \
  --name braindump-braindump-staging-1 \
  --env-file .env.staging \
  --network traefik \
  --network postgres \
  --restart unless-stopped \
  ghcr.io/loskylp/braindump:<image-id>
```

---

## 8. How to Run Migrations Manually

Migrations run automatically on every container start via `docker-entrypoint.sh`. Running them manually is only needed if:
- The entrypoint script is bypassed
- You need to roll back a migration (migrate:undo)
- You need to check migration status

```sh
ssh deploy@nxlabs.cc

# Check current migration status
docker exec braindump-braindump-staging-1 npx sequelize-cli db:migrate:status

# Run pending migrations (normally done automatically by entrypoint)
docker exec braindump-braindump-staging-1 npx sequelize-cli db:migrate

# Roll back the most recent migration
docker exec braindump-braindump-staging-1 npx sequelize-cli db:migrate:undo
```

**Migration behavior:**
- Migrations are idempotent: running `db:migrate` on an already-up-to-date database is a safe no-op.
- If a migration fails, the entrypoint script exits non-zero, the container does not start, and Watchtower leaves the previous container running. This is the primary rollback mechanism.
- Migration failures are visible in container logs: `docker logs braindump-braindump-staging-1`.

---

## 9. Environment Variables

All environment configuration is via `.env` files on the server. These files are never committed to version control. See `process/devops/environment-contract-v1.md` for the full variable reference.

**Staging** (`/opt/braindump/.env.staging`):

| Variable | Value pattern |
|---|---|
| `POSTGRES_URL` | `postgresql://braindump:<password>@postgres:5432/braindump` |
| `SESSION_SECRET` | Long random string, unique to staging |
| `NODE_ENV` | `staging` |
| `APP_URL` | `https://braindump.staging.nxlabs.cc` |
| `EMAIL_PROVIDER` | `console` (no real email sent from staging) |
| `EMAIL_FROM` | `noreply@staging.nxlabs.cc` |

**Production** (`/opt/braindump/.env.prod`): Not yet provisioned (Phase 3). Will use a separate database, separate session secret, and a real email provider.

**To update an environment variable:**
1. Edit the `.env.staging` file on the server.
2. Restart the container: `docker compose -f docker-compose.staging.yml up -d`

Changes take effect immediately on restart. No image rebuild required for env var changes.

---

## 10. Production Promotion (Continuous Delivery)

Production deploys happen on Nexus approval at Demo Sign-off, not automatically. The operator promotes the staging-proven image:

```sh
# Authenticate with GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin

# Re-tag the staging image as latest (production)
docker pull ghcr.io/loskylp/braindump:staging
docker tag ghcr.io/loskylp/braindump:staging ghcr.io/loskylp/braindump:latest
docker push ghcr.io/loskylp/braindump:latest
```

Watchtower on nxlabs.cc detects the new `:latest` image and restarts the `braindump-prod` container within 5 minutes.

**The `:latest` tag is never pushed by CI directly.** Only the operator pushes `:latest`, after Nexus Demo Sign-off approval. This is the gating mechanism for production deployments.

---

## 11. Uptime Monitoring

Uptime Kuma monitors the staging health endpoint automatically via AutoKuma Docker label integration.

**Monitor:** "BrainDump Staging" at `https://braindump.staging.nxlabs.cc/api/health`
**Dashboard:** https://status.nxlabs.cc

**How auto-registration works:**
- AutoKuma watches Docker container labels.
- The `kuma.braindump-staging.http.*` labels on the container cause AutoKuma to create an HTTP monitor in Uptime Kuma automatically.
- If the monitor is not visible in https://status.nxlabs.cc, check AutoKuma logs: `docker logs autokuma --tail 50`

**Manual registration (fallback if AutoKuma is not working):**
1. Open https://status.nxlabs.cc (Uptime Kuma dashboard).
2. Add monitor: Type = HTTP(s), URL = `https://braindump.staging.nxlabs.cc/api/health`, check interval = 60 seconds.
3. Expected: HTTP 200 with `{"status":"ok","db":"connected"}`.

**Alert thresholds (per ADR-007 fitness functions):**
- Warning: 2 consecutive health check failures
- Critical: 5 consecutive health check failures

---

## 12. CI Pipeline Reference

Pipeline file: `.github/workflows/ci.yml`
Triggers: every push and PR to `main`

| Job | What it does | Database |
|---|---|---|
| `lint` | ESLint on backend and frontend | None |
| `unit-tests` | Jest unit tests (no DB) | None |
| `integration-tests` | Jest integration tests | Ephemeral PostgreSQL 16 (CI service container) |
| `migration-test` | Fresh DB, all migrations, full test suite (`--runInBand`) | Ephemeral PostgreSQL 16 (CI service container) |
| `build-and-push` | Build Docker image; push `:staging` to ghcr.io on green `main` push | None |

`build-and-push` depends on all four test jobs. The image is only pushed when all tests pass.

**OBS-V004-05 resolution:** The `migration-test` job runs the full suite with `--runInBand` (serial execution). This prevents intermittent timeout failures caused by parallel Jest workers sharing a single PostgreSQL session store connection pool.

---

## 13. Known Parity Gaps (Staging vs. Production)

| Gap | Description | Risk |
|---|---|---|
| Database naming | Staging DB is `braindump`/`braindump` (not `braindump_staging`/`braindump_staging` per ADR-007) | Low -- databases are isolated; naming is cosmetic for staging |
| `NODE_ENV` | Staging uses `staging` instead of `production` | Application code must treat `staging` and `production` equivalently (documented in environment-contract-v1.md) |
| Email | Staging uses `EMAIL_PROVIDER=console`; production uses a real provider | Email delivery bugs not caught until production |
| Production env | Production environment not yet provisioned (Phase 3) | No production risk until Phase 3 |

---

## 14. Self-Verification Evidence

This runbook was written after verifying the following:

| Check | Evidence |
|---|---|
| Staging container healthy | `curl https://braindump.staging.nxlabs.cc/api/health` returns `{"status":"ok","db":"connected"}` (HTTP 200) |
| Migrations run on startup | Container logs show `[entrypoint] Running Sequelize migrations...` and `[entrypoint] Migrations complete. Starting application...` |
| Migrations are idempotent | "No migrations were executed, database schema was already up to date." in container logs |
| Watchtower polling | Watchtower logs show `scanned=2 updated=0` every 5 minutes; `scanned=2 updated=1` when new image detected |
| Watchtower restart | Logs show `Found new image`, `Stopping container`, `Started new container` on image update |
| Traefik routing | HTTPS response at `braindump.staging.nxlabs.cc` (TLS cert via Let's Encrypt) |
| Watchtower label | `com.centurylinklabs.watchtower.enable=true` on container |
| Uptime Kuma labels | `kuma.braindump-staging.http.name` and `kuma.braindump-staging.http.url` on container |
| Service name aligned | Container named `braindump-braindump-staging-1` (service `braindump-staging` per ADR-007) |
| CI pipeline | All 5 jobs green on every recent main branch push |
