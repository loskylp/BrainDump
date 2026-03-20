# ADR-007: Deployment Model
**Date:** 2026-03-19 | **Revised:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

BrainDump is a monolithic web application (Nexus constraint) serving a public user base. It is a free service with no revenue -- deployment costs must be predictable and low. The Manifest specifies Continuous Delivery: code is always deployable, actual deployment happens at Demo Sign-off when the Nexus approves. The application requires PostgreSQL, an email service integration, and TLS for a public-facing web application.

The Nexus has provided a canonical infrastructure integration guide for the target server (`nxlabs.cc`). The infrastructure provides shared services (Traefik reverse proxy, PostgreSQL 16, Watchtower auto-updates, CrowdSec security, Uptime Kuma monitoring) that BrainDump must integrate with rather than provision independently. This significantly simplifies the deployment model -- BrainDump is a single Docker container that joins existing networks.

**Driver:** Deployment model, CD philosophy, Reliability
**Door type:** One-way -- deployment infrastructure shapes CI pipelines, environment configuration, backup strategy, and operational procedures

## Trade-off Analysis

### Hosting Strategy

The hosting strategy is no longer an open decision. The Nexus has designated `nxlabs.cc` as the target server with a pre-existing infrastructure stack. The trade-off analysis from the original ADR-007 (VPS vs. PaaS vs. Kubernetes) is superseded -- the answer is: single server with shared infrastructure services, Docker Compose for the application container only.

### Deployment Mechanism

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Watchtower auto-pull (image tag polling) | Zero-touch deployment after image push, no SSH deploy scripts, rolling restart with no downtime, already running on the server | Less control over exact deploy timing, 5-minute polling delay between push and deploy | Image pushed before CI completes (mitigated by CI gating image push) | LOW -- disable Watchtower label, add manual deploy script |
| SSH-based deploy script (pull + restart) | Exact control over deploy timing, immediate deployment | Must maintain deploy script, SSH key management, manual step in pipeline | Script rot, SSH credential management | LOW -- switch to Watchtower label |
| CI-triggered SSH (GitHub Actions SSH step) | Automated exact-time deployment | SSH key in CI secrets, network dependency on deploy target during CI | CI failure blocks deployment even when image is fine | MEDIUM -- restructure pipeline |

**Recommendation:** Watchtower auto-pull for both staging and production
**Because:** Watchtower is already running on the server and provides rolling restarts (no downtime). The CI pipeline gates the image push -- only a CI-green build pushes to the registry. The 5-minute polling delay is acceptable. This eliminates deploy scripts, SSH-in-CI, and manual deployment steps entirely.

**CD philosophy adaptation:** The Manifest specifies Continuous Delivery with production deploy on Nexus approval. With Watchtower, the mechanism changes: staging deploys automatically when CI pushes the `:staging` tag. Production deploys when the Nexus approves and the operator re-tags the staging-proven image as `:latest` and pushes it. The `:latest` tag is reserved for production -- CI never pushes it directly. The Nexus remains the gatekeeper -- the trigger is a tag promotion, not an SSH command.

## Decision

### Target Infrastructure

```
Server: nxlabs.cc (187.124.233.130)
OS: Ubuntu 24.04 LTS
Deploy user: deploy (SSH key only, root login disabled)

Shared services (already running -- do NOT provision):
  Traefik v3         -- reverse proxy, TLS via Let's Encrypt ACME, HTTP->HTTPS redirect
  PostgreSQL 16      -- shared instance, accessed via hostname `postgres` on internal network
  Watchtower         -- auto-updates containers via image polling (every 5 min)
  CrowdSec + bouncer -- security (rate limiting, bot detection, IP reputation)
  AutoKuma + Uptime Kuma -- uptime monitoring at https://status.nxlabs.cc
```

### Environments

Staging and production are two distinct environments on the same physical server, each with its own provisioned database, credentials, image tag, and Docker Compose file. Credentials are never shared between environments.

| Environment | Subdomain | Image tag | Compose file | DB user/database | Auto-deploy |
|---|---|---|---|---|---|
| Production | `braindump.nxlabs.cc` | `ghcr.io/<org>/braindump:latest` | `/opt/braindump/docker-compose.prod.yml` | `braindump_prod` / `braindump_prod` | Yes (Watchtower, after Nexus approval re-tags image) |
| Staging | `braindump.staging.nxlabs.cc` | `ghcr.io/<org>/braindump:staging` | `/opt/braindump/docker-compose.staging.yml` | `braindump_staging` / `braindump_staging` | Yes (Watchtower, on every CI-green push) |

**Image tag convention:** CI pushes `:staging` on every green build. Watchtower picks it up for staging. When the Nexus approves at Demo Sign-off, the operator re-tags the staging-proven image as `:latest` and pushes it. Watchtower picks up `:latest` for production. The `:latest` tag is reserved for production -- it is never pushed by CI directly.

### Database Provisioning

Each environment has its own database, provisioned once (not per deploy) on the shared PostgreSQL 16 instance:

**Production:**
```
ssh deploy@nxlabs.cc /opt/postgres/provision.sh braindump-prod
```
Creates user `braindump_prod` and database `braindump_prod`. Prints credentials once -- store in `/opt/braindump/.env.prod`.

**Staging:**
```
ssh deploy@nxlabs.cc /opt/postgres/provision.sh braindump-staging
```
Creates user `braindump_staging` and database `braindump_staging`. Prints credentials once -- store in `/opt/braindump/.env.staging`.

The shared PostgreSQL instance is accessed via hostname `postgres` on the internal `postgres` Docker network. BrainDump does not run its own PostgreSQL container.

### Docker Compose (Production)

Location on server: `/opt/braindump/docker-compose.prod.yml`
Environment file: `/opt/braindump/.env.prod`

```yaml
services:
  braindump-prod:
    image: ghcr.io/<org>/braindump:latest
    restart: unless-stopped
    env_file:
      - .env.prod
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.braindump-prod.rule=Host(`braindump.nxlabs.cc`)"
      - "traefik.http.routers.braindump-prod.tls.certresolver=letsencrypt"
      - "traefik.http.routers.braindump-prod.entrypoints=websecure"
      - "traefik.http.services.braindump-prod.loadbalancer.server.port=3000"
      - "com.centurylinklabs.watchtower.enable=true"
      - "kuma.braindump-prod.http.name=BrainDump"
      - "kuma.braindump-prod.http.url=https://braindump.nxlabs.cc"
    networks:
      - traefik
      - postgres

networks:
  traefik:
    external: true
  postgres:
    external: true
```

**`.env.prod` contents (template -- actual values from provision.sh output):**
```
POSTGRES_URL=postgresql://braindump_prod:<password>@postgres:5432/braindump_prod
SESSION_SECRET=<generate-unique-secret>
NODE_ENV=production
APP_URL=https://braindump.nxlabs.cc
EMAIL_PROVIDER=<provider-name>
EMAIL_API_KEY=<api-key>
EMAIL_FROM=noreply@nxlabs.cc
```

### Docker Compose (Staging)

Location on server: `/opt/braindump/docker-compose.staging.yml`
Environment file: `/opt/braindump/.env.staging`

```yaml
services:
  braindump-staging:
    image: ghcr.io/<org>/braindump:staging
    restart: unless-stopped
    env_file:
      - .env.staging
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.braindump-staging.rule=Host(`braindump.staging.nxlabs.cc`)"
      - "traefik.http.routers.braindump-staging.tls.certresolver=letsencrypt"
      - "traefik.http.routers.braindump-staging.entrypoints=websecure"
      - "traefik.http.services.braindump-staging.loadbalancer.server.port=3000"
      - "com.centurylinklabs.watchtower.enable=true"
      - "kuma.braindump-staging.http.name=BrainDump Staging"
      - "kuma.braindump-staging.http.url=https://braindump.staging.nxlabs.cc"
    networks:
      - traefik
      - postgres

networks:
  traefik:
    external: true
  postgres:
    external: true
```

**`.env.staging` contents (template -- actual values from provision.sh output):**
```
POSTGRES_URL=postgresql://braindump_staging:<password>@postgres:5432/braindump_staging
SESSION_SECRET=<generate-unique-secret-different-from-prod>
NODE_ENV=staging
APP_URL=https://braindump.staging.nxlabs.cc
EMAIL_PROVIDER=console
EMAIL_API_KEY=
EMAIL_FROM=noreply@staging.nxlabs.cc
```

### Deployment Pipeline (Continuous Delivery)

```
Developer pushes to main
    |
    v
CI (GitHub Actions)
    |-- Lint
    |-- Unit tests (frontend + backend)
    |-- Integration tests (against test PostgreSQL in CI)
    |-- Migration test (fresh DB + full migration + test suite)
    |-- Build Docker image
    |-- Push ghcr.io/<org>/braindump:staging to GitHub Container Registry
    |
    v
Watchtower on nxlabs.cc (polls every 5 min)
    |-- Detects new :staging image
    |-- Pulls image
    |-- Rolling restart of braindump-staging container (no downtime)
    |-- Uptime Kuma verifies staging is healthy
    |
    v
[HOLD -- waiting for Nexus approval at Demo Sign-off]
    |
    v
Operator re-tags image for production:
    |-- docker tag ghcr.io/<org>/braindump:staging ghcr.io/<org>/braindump:latest
    |-- docker push ghcr.io/<org>/braindump:latest
    |
    v
Watchtower on nxlabs.cc (polls every 5 min)
    |-- Detects new :latest image
    |-- Pulls image
    |-- Rolling restart of braindump-prod container (no downtime)
    |-- Uptime Kuma verifies production is healthy
```

### Schema Migrations

Migrations must run before the new application code serves requests. The Docker image entrypoint script handles this:

```
#!/bin/sh
npx sequelize-cli db:migrate && node server.js
```

If migrations fail, the container exits and Watchtower does not replace the running container (the old container continues serving). This provides a natural rollback: the previous container keeps running until the migration issue is fixed and a new image is pushed.

### Environment Configuration

All environment-specific configuration is via environment variables (12-factor app), stored in per-environment `.env` files on the server:
- Production: `/opt/braindump/.env.prod`
- Staging: `/opt/braindump/.env.staging`

Credentials are never shared between environments. Each `.env` file is readable only by the `deploy` user.

| Variable | Description | Required |
|---|---|---|
| `POSTGRES_URL` | PostgreSQL connection string (from provision.sh output, unique per environment) | Yes |
| `SESSION_SECRET` | Secret for signing session cookies (unique per environment) | Yes |
| `NODE_ENV` | `development`, `staging`, or `production` | Yes |
| `EMAIL_PROVIDER` | Email service provider name (`console` in staging, real provider in production) | Yes |
| `EMAIL_API_KEY` | Email service API key | Production only |
| `EMAIL_FROM` | Sender email address | Yes |
| `APP_URL` | Public URL of the application (for password reset links) | Yes |

### Health Check

`GET /api/health` returns:
- 200 with `{ status: "ok", db: "connected" }` when the app can connect to PostgreSQL
- 503 with `{ status: "error", db: "disconnected" }` when the database connection fails

This endpoint is used by:
- Uptime Kuma (via AutoKuma Docker labels -- auto-registered)
- Traefik health checks (if configured at the router level)
- Manual smoke tests during initial deployment

### Networking

The BrainDump container must join two external Docker networks:
- **`traefik`** -- for the reverse proxy to route HTTPS traffic to the container
- **`postgres`** -- for the application to reach the shared PostgreSQL instance via hostname `postgres`

The container exposes port 3000 internally. Traefik routes external HTTPS traffic to this port based on the `Host()` rule in the Docker labels. Port 3000 is never exposed to the public internet.

### Security

CrowdSec with the Traefik ForwardAuth bouncer is already active on the server. This provides:
- IP reputation-based blocking
- Rate limiting at the reverse proxy level
- Bot detection

BrainDump benefits from this without any application-level configuration. The Sentinel agent should verify that CrowdSec coverage is adequate and recommend additional application-level protections if needed.

### What BrainDump Does NOT Provision

The following are shared infrastructure services. BrainDump integrates with them via Docker labels and network membership -- it does not install, configure, or manage them:

1. **Traefik** -- do not install Nginx or any reverse proxy
2. **PostgreSQL** -- do not run a PostgreSQL container; use the shared instance
3. **TLS certificates** -- Traefik handles Let's Encrypt ACME automatically
4. **Uptime monitoring** -- AutoKuma auto-registers from Docker labels
5. **Security/WAF** -- CrowdSec is server-level infrastructure
6. **Container updates** -- Watchtower handles image pulling and rolling restart

## Fitness Functions

**Dev:**
- CI pipeline completes (lint + test + build + migration test) in < 10 minutes
- Docker image builds successfully and starts within 5 seconds
- Health check endpoint returns 200 after container start
- Entrypoint script runs migrations before starting the application server

**Prod:**
- Uptime Kuma health check (auto-registered via Docker labels): Warning: 2 consecutive failures | Critical: 5 consecutive failures (monitored at https://status.nxlabs.cc)
- Watchtower successfully pulls and restarts on image update (check Watchtower logs)
- TLS certificate validity: managed by Traefik ACME -- no BrainDump-side monitoring needed (Traefik auto-renews)
- Server resource utilization: Warning: CPU > 80% sustained for 5 min or memory > 80% | Critical: CPU > 95% or memory > 95%

## Consequences

- **No deploy scripts or SSH-in-CI.** Deployment is push-to-registry + Watchtower. This eliminates an entire class of deployment tooling and credentials management.
- **No downtime during deploys.** Watchtower performs rolling restarts -- the old container serves traffic until the new one is healthy.
- **Migration-on-startup risk.** If a migration is destructive and the new code fails, the old container (which Watchtower would have stopped) is gone. Mitigation: Watchtower only replaces the container when the new one starts successfully. If the entrypoint script (migrate + start) fails, the old container keeps running.
- **Shared PostgreSQL means shared fate.** If the PostgreSQL instance has issues, all services on nxlabs.cc are affected, not just BrainDump. Mitigation: PostgreSQL is a managed shared service with its own backup and monitoring.
- **Backup responsibility shifts.** Database backups are the infrastructure's responsibility (shared PostgreSQL instance), not BrainDump's. See ADR-003 annotation for implications.
- **5-minute deploy latency.** Watchtower polls every 5 minutes -- there is a delay between image push and container restart. This is acceptable for a free service.
- **Separate databases per environment.** Production and staging each have their own PostgreSQL user and database, provisioned independently. This prevents staging data from leaking into production and allows schema migrations to be tested on staging before promotion.
- **Per-environment .env files.** Each environment's credentials live in its own `.env` file on the server. These files are never committed to version control.
- **CrowdSec provides server-level rate limiting.** The original ADR-007 deferred rate limiting; CrowdSec now provides a baseline. Application-level rate limiting remains a Sentinel decision.
- **Docker Compose files live on the server in `/opt/braindump/`.** The DevOps agent must include these in the deployment documentation and ensure they are version-controlled (the compose files themselves, not the `.env` files).
