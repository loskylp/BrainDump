# Verification Report — TASK-031: DevOps Phase 3 — production environment

**Verdict:** PASS (with deferred ACs noted below)
**Task:** TASK-031 — DevOps Phase 3 — production environment
**Requirement:** REQ-012, Manifest CD philosophy
**ADR:** ADR-007
**Date:** 2026-03-21
**Verifier invocation:** Initial

---

## CI Run Results — Run 23391891498

| Job | Status | Duration |
|---|---|---|
| Lint | PASS | 16s |
| Unit Tests | PASS | 45s |
| Integration Tests | PASS | 29s |
| Migration Test | PASS | 2m 51s |
| Build Docker Image | PASS | 20s |

All 5 jobs passed. Two pre-existing lint warnings are present (unrelated to TASK-031 deliverables): `sequelize` assigned but unused in `backend/src/services/tagService.js`; `isProduction` assigned but unused in `backend/src/config/database.js`. These were introduced by earlier tasks and are recorded observations from prior cycles.

---

## Deferred ACs (server-side — not automatable from repo)

The following acceptance criteria require operator action on the nxlabs.cc server and cannot be verified through code review or CI alone. They are marked DEFERRED and must be verified by the Nexus after the first production deployment.

| AC | Description | Why deferred |
|---|---|---|
| AC-2 | Production database provisioned via `provision.sh braindump-production` on nxlabs.cc | Requires SSH access to nxlabs.cc; server-side command, not representable in CI |
| AC-3 | `.env.production` configured on the server with production DB URL, session secret, email provider | Secrets file on server; never committed to repo by design |
| AC-9 | Health endpoint returns 200 at `https://braindump.nxlabs.cc/api/health` | Requires the production container to be running on nxlabs.cc |

These three ACs are fully supported by the delivered artifacts (Compose file, `.env.production.example`, runbook Sections 14 and 15) — the infrastructure is ready to execute them. DEFERRED status means: not blocked, pending first Go-Live operator run.

---

## Code Review Findings

### docker-compose.production.yml

Verified against AC-1, AC-4, AC-5, AC-6, AC-7, AC-8.

**Service name (AC-1):** `braindump-production` — correct. Matches ADR-007 naming convention.

**Image tag (AC-1 / AC-6):** `ghcr.io/loskylp/braindump:latest` — correct. The `:latest` tag is the one Watchtower tracks and is pushed by CI only on a `v*` git tag push (verified in `ci.yml` below).

**Traefik host rule (AC-5):** `traefik.http.routers.braindump-production.rule=Host(\`braindump.nxlabs.cc\`)` — correct. This is the production domain. Not `braindump.staging.nxlabs.cc` (which would be wrong). TLS via Let's Encrypt (`tls.certresolver=letsencrypt`) and `websecure` entrypoint are both present. Load balancer port 3000 is correct.

**Watchtower label (AC-6):** `com.centurylinklabs.watchtower.enable=true` — present and correct.

**Uptime Kuma labels (AC-7):**
- `kuma.braindump-production.http.name=BrainDump Production` — present
- `kuma.braindump-production.http.url=https://braindump.nxlabs.cc/api/health` — present and targets the correct production URL (not the staging URL)

**Networks (AC-4):** `traefik` and `postgres` both declared as `external: true` and joined by the service — correct. This matches the shared infrastructure topology documented in ADR-007 and Section 1 of the runbook.

**AC-8 (migrations on startup):** The Compose file uses `env_file: .env.production` and does not override `entrypoint` or `command`. The container's `docker-entrypoint.sh` (established in earlier cycles) runs `npx sequelize-cli db:migrate` before `exec node src/server.js`. This behavior is confirmed by the Migration Test job in CI (which runs the same entrypoint path on a fresh DB). The Compose file correctly does not interfere with this mechanism.

**Finding:** No defects. All repo-verifiable ACs satisfied.

---

### .github/workflows/ci.yml

Verified against the tag push trigger requirement (AC-6 dependency) and the DevOps Phase 3 delivery contract.

**`on.push.tags: ["v*"]` present:** Line 6 of the workflow: `tags: ["v*"]` — present and correct alongside the existing `branches: ["main"]` trigger. Both triggers are active simultaneously; they do not conflict.

**Login condition includes tag trigger (lines 217-218):**
```
if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))
```
Correct. Login runs on both main branch pushes and v* tag pushes.

**Push condition includes tag trigger (line 244):**
```
push: ${{ github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')) }}
```
Correct. Image is pushed on both main branch pushes and v* tag pushes. PR builds validate without pushing.

**Cache-to condition (line 249):**
```
cache-to: ${{ (github.event_name == 'push' && github.ref == 'refs/heads/main') && format('type=registry,...') || '' }}
```
Cache is written only on main branch pushes (not on tag pushes). This is intentional and correct — tag pushes benefit from the cache written by the preceding main branch build. No issue here.

**Metadata emits `:latest` and `:<version>` on tag push (lines 234-236):**
```
type=semver,pattern={{version}},enable=${{ ... startsWith(github.ref, 'refs/tags/v') }}
type=raw,value=latest,enable=${{ ... startsWith(github.ref, 'refs/tags/v') }}
```
Both tags are emitted on v* tag push. On main branch push, only `:staging` is emitted. On PR, no tags are pushed (build-only validation). The gating logic is correct — `:latest` is exclusively a production release artifact, never produced by a commit push.

**Finding:** No defects. Workflow satisfies the production CD contract.

---

### .env.production.example

Verified against the variable completeness requirement (supporting AC-3).

| Variable | Present | Value |
|---|---|---|
| `POSTGRES_URL` | Yes | `postgresql://braindump_prod:<password>@postgres:5432/braindump_prod` |
| `SESSION_SECRET` | Yes | `<long-random-string-minimum-64-chars>` (placeholder with minimum length guidance) |
| `NODE_ENV` | Yes | `production` |
| `APP_URL` | Yes | `https://braindump.nxlabs.cc` |
| `EMAIL_PROVIDER` | Yes | `console` |
| `EMAIL_FROM` | Yes | `noreply@nxlabs.cc` |

All 6 required variables are present. The placeholder values are descriptive and guide the operator to correct values. The file header correctly warns against committing `.env.production` and references `environment-contract-v1.md` for the full variable reference. The `SESSION_SECRET` placeholder explicitly states the minimum 64-character requirement and "different from staging" constraint — both operationally important.

**Finding:** No defects. All required variables present with appropriate guidance.

---

### process/devops/deployment-runbook.md

Verified against AC-10 (rollback procedure documented) and the production setup requirement (supporting AC-2, AC-3).

**Production setup section (Section 14 — "Production Environment Setup"):** Present. Covers all four setup steps: database provisioning (`provision.sh braindump-production`), env file creation from template, Compose pull and start, and health verification. Each step is linked to its corresponding AC. Clear and complete.

**Release procedure (Section 15 — "Production Release Procedure"):** Present. Includes the exact command sequence:
```
git tag v3.0.0
git push origin v3.0.0
```
This is the correct pattern (`git tag v*.*.* && git push origin v*.*.*` per the AC). The section also covers post-release verification steps and production log commands.

**Rollback procedure (Section 16 — "Production Rollback Procedure," AC-10):** Present. Two rollback options documented: Option A (pin to a previous version tag in the Compose file, preferred), Option B (re-tag locally cached image). Rollback verification command included. The mechanism correctly leverages Watchtower's digest-based detection — pinning to a previous tag causes Watchtower to pull it on next poll cycle.

**SESSION_SECRET rotation (Section 17 — "Production Environment Variable Management"):** Present. Rotation procedure is complete: generate new secret with `openssl rand -base64 64`, edit `.env.production`, restart container. The section explicitly warns that rotation invalidates all active sessions and advises scheduling during low-traffic periods. The note that there is no zero-downtime session rotation mechanism is accurate and appropriate.

**Finding:** No defects. All required runbook sections present and complete.

---

## Acceptance Criteria Verdict

| AC | Description | Status | Evidence |
|---|---|---|---|
| AC-1 | Docker Compose file for production | PASS | `docker-compose.production.yml` present; service name `braindump-production`, image `ghcr.io/loskylp/braindump:latest` |
| AC-2 | Production database provisioned via `provision.sh braindump-production` | DEFERRED | Server-side action. Documented in runbook Section 14, Step 1. Must be executed by operator at Go-Live. |
| AC-3 | `.env.production` configured on server | DEFERRED | Server-side action. `.env.production.example` committed with all required variables. Runbook Section 14, Step 2. |
| AC-4 | Container joins `traefik` and `postgres` external Docker networks | PASS | Both networks declared `external: true` and joined by the `braindump-production` service |
| AC-5 | Traefik routes `braindump.nxlabs.cc` to production container | PASS | Host rule: `Host(\`braindump.nxlabs.cc\`)` — production domain, not staging; TLS and entrypoint correct |
| AC-6 | Watchtower picks up new `:latest` images | PASS | Watchtower label present in Compose; CI pushes `:latest` on `v*` tag push (verified in `ci.yml`) |
| AC-7 | Uptime Kuma auto-registers via Docker labels | PASS | Both `kuma.braindump-production.http.name` and `kuma.braindump-production.http.url` labels present, targeting production URL |
| AC-8 | Migrations run on container startup before application server starts | PASS | Compose file does not override entrypoint; container's `docker-entrypoint.sh` runs migrations first (same pattern as staging, validated by Migration Test CI job) |
| AC-9 | Health endpoint returns 200 at `https://braindump.nxlabs.cc/api/health` | DEFERRED | Requires running production container on nxlabs.cc. Verification command documented in runbook Section 14, Step 4 and Section 15. |
| AC-10 | Rollback procedure documented | PASS | Runbook Section 16 documents two rollback options with verification steps |

**Summary:** 7 of 10 ACs PASS (repo-verifiable). 3 ACs DEFERRED (require server-side operator action — AC-2, AC-3, AC-9). No ACs FAIL.

---

## CI Pipeline — Tag Push Behavior Verified

This run (23391891498) was triggered by a `push` to `main` (not a `v*` tag). This is the expected pre-release CI validation. The tag push path (`v*` → `:latest` + `:<version>`) was verified by static code review of the workflow conditions — the `startsWith(github.ref, 'refs/tags/v')` expressions are correct and will activate on the first `git tag v*.*.* && git push origin v*.*.*` after Go-Live approval.

The Build Docker Image job completed in 20s on this run. Because this was a `main` branch push (not a tag push), it pushed `:staging` and wrote the layer cache to `buildcache`. This is correct behavior.

---

## Observations

**OBS-V031-01 — Node.js 20 actions deprecation notice**

All CI job annotations include a GitHub Actions deprecation warning for `actions/checkout@v4` and `actions/setup-node@v4` (and Docker actions in the build job): Node.js 20 actions will be forced to Node.js 24 by default starting 2026-06-02. This is not a failure today, but the DevOps agent should plan to update these actions before the June deadline. The fix is straightforward (update action versions if Node.js 24-compatible versions are available). This is a non-blocking observation.

**OBS-V031-02 — Pre-existing lint warnings unrelated to this task**

Two ESLint warnings persist from earlier cycles:
- `'sequelize' is assigned a value but never used` in `backend/src/services/tagService.js:11`
- `'isProduction' is assigned a value but never used` in `backend/src/config/database.js:30`

These were introduced by TASK-027 and an earlier cycle respectively. They are warnings (not errors) and do not affect CI pass/fail. They should be cleaned up in a future maintenance pass but are not a blocker for TASK-031.

**OBS-V031-03 — Cache-to restricted to main branch push (intentional)**

The `cache-to` step in the build job only executes on `main` branch pushes, not on `v*` tag pushes. This means a tag push (production release) does not update the build cache. This is correct design: the cache is populated by the continuous stream of main branch commits, and the release tag build benefits from that existing cache. No action required.

**OBS-V031-04 — Rollback modifies version-controlled Compose file in-place**

The documented rollback Option A (Section 16) instructs the operator to `nano docker-compose.production.yml` on the server to pin to a previous image tag. This means the live Compose file on the server diverges from the version-controlled file in the repo during a rollback. This is a known and accepted trade-off for the single-server deployment model (ADR-007). The operator should remember to restore `:latest` in the Compose file and `git pull` to resync after the incident is resolved. Consider documenting this resync step in a future runbook revision.

---

## Verdict

**PASS**

All repo-verifiable acceptance criteria are satisfied. Three ACs (AC-2, AC-3, AC-9) are DEFERRED pending first-time server-side setup by the operator — the infrastructure code and runbook documentation fully support their execution. CI run 23391891498 is green across all 5 jobs. The production CD pipeline is correctly gated behind `v*` git tag pushes, ensuring `:latest` is never pushed on a development commit.

The production environment is ready for Go-Live deployment. Operator action required: execute runbook Sections 14 and 15 after Nexus Go-Live approval.
