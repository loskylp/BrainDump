# Demo Script — TASK-021: DevOps Phase 2

**Task:** TASK-021 — Staging environment and CD pipeline formalization
**Date:** 2026-03-21
**Verdict:** PASS
**Audience:** Nexus — infrastructure verification walkthrough

This is an infrastructure task. There is no user-facing feature to demonstrate in the browser. The demo verifies the CD pipeline, staging health, and runbook completeness.

---

## Scenario 1 — Staging environment is live and healthy

Verifies AC-1 (Docker Compose deployed), AC-3 (env configured), AC-4 (networks joined), AC-5 (Traefik routing active), AC-8 (migrations ran on startup).

Given   the staging environment is deployed to `braindump.staging.nxlabs.cc`
When    a health check is issued against the staging API
Then    the endpoint returns HTTP 200 with a live database connection confirmed

Run from any terminal:

```sh
curl -s https://braindump.staging.nxlabs.cc/api/health
```

Expected response:

```json
{"status":"ok","db":"connected"}
```

---

## Scenario 2 — CI pipeline gates image push on all tests passing

Verifies AC-6 (Watchtower auto-deploy), FF-D33 (`:staging` only after green build), FF-D34 (no `:latest` from CI).

Given   the CI workflow at `.github/workflows/ci.yml` is active
When    CI run 23385582169 (commit 49c6fa8) is inspected on GitHub Actions
Then    all 5 jobs pass (Lint, Unit Tests, Integration Tests, Migration Test, Build Docker Image)
And     the Build Docker Image job is gated on the 4 test jobs completing successfully
And     the image pushed is tagged `:staging` only — `:latest` is not pushed by CI

Inspect the run at: https://github.com/loskylp/BrainDump/actions/runs/23385582169

---

## Scenario 3 — Migration test runs serially with --runInBand (OBS-V004-05 resolution)

Verifies the `--runInBand` fix, AC-8 (migrations run before app starts), FF-D43.

Given   the `migration-test` job in CI run 23385582169
When    the "Run full test suite after migrations" step log is inspected
Then    the command shows `npx jest --forceExit --runInBand`
And     34 test suites pass, 610 tests pass, 7 skipped
And     no timeout failures occur

In the CI run view, expand the Migration Test job and look for:

```
npx jest --forceExit --runInBand
...
Test Suites: 34 passed, 34 total
Tests:       7 skipped, 610 passed, 617 total
Time:        104.784 s
Ran all test suites.
```

---

## Scenario 4 — Docker Compose file is aligned with ADR-007

Verifies AC-1 (Compose file), AC-4 (network membership), AC-5 (Traefik labels), AC-6 (Watchtower label), AC-7 (Uptime Kuma labels).

Given   the staging Docker Compose file at `docker-compose.staging.yml` in the repository root
When    the file is opened
Then    the service is named `braindump-staging`
And     the image is `ghcr.io/loskylp/braindump:staging`
And     the container joins both `traefik` (external) and `postgres` (external) networks
And     Traefik labels route `braindump.staging.nxlabs.cc` to port 3000
And     `com.centurylinklabs.watchtower.enable=true` is set
And     `kuma.braindump-staging.http.url=https://braindump.staging.nxlabs.cc/api/health` is set

File location: `docker-compose.staging.yml` (repository root)

---

## Scenario 5 — Deployment runbook is complete

Verifies that the runbook at `process/devops/deployment-runbook.md` covers all required operational procedures.

Given   the deployment runbook is at `process/devops/deployment-runbook.md`
When    the runbook is reviewed
Then    it covers: automatic deployment flow (Section 3), manual redeployment (Section 4), log access (Section 5), staging health verification (Section 6), rollback (Section 7), migration commands (Section 8), environment variable management (Section 9), and known parity gaps (Section 13)
And     the self-verification evidence table (Section 14) documents what was directly observed during DevOps Phase 2

File: `process/devops/deployment-runbook.md`

---

## Known Gap (Documented)

The staging database was provisioned as `braindump`/`braindump` rather than `braindump_staging`/`braindump_staging` as specified in ADR-007. This is documented in the runbook (Section 1) and assessed as low-risk. Production will use the correct naming (`braindump_prod`). The Nexus should acknowledge this gap at the demo if reviewing parity with ADR-007.
