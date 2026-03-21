# Verification Report — TASK-024
**Task:** TASK-024 — Rate limiting on authentication endpoints (SEC-001)
**Requirement(s):** REQ-001, REQ-002 (security hardening), ADR-002
**Source:** Sentinel Cycle 1 Security Report — SEC-001
**Fitness Functions:** FF-D03, FF-D04
**Date:** 2026-03-21
**Iteration:** 2
**Verdict:** PASS

---

## Summary

All six acceptance criteria pass. CI run 23376388683 is fully green across all five jobs: Lint, Unit Tests, Integration Tests, Migration Test, and Build Docker Image. The two root causes identified in iteration 1 are resolved:

1. `express-rate-limit` is now committed to `backend/package.json` `dependencies` (commit `c9d19dc`), resolving the `Cannot find module 'express-rate-limit'` CI failure.
2. `authRateLimiter` now includes `skip: () => process.env.NODE_ENV === 'test'` (commit `3a6991f`), resolving acceptance-test interference in the migration-test CI job.

The `skip` fix is safe in production: `NODE_ENV=production` in staging, confirmed by staging returning `RateLimit-*` headers on all auth endpoint responses. Live staging probing confirms the limiter is active: 9 sequential requests returned 401 (within the window), the 10th returned 429 (limit enforced), and subsequent requests received 403 from the Traefik-level infrastructure block — evidence that the app-level limiter and the infra-level protection are both functioning correctly.

All 27 verifier acceptance tests pass locally. All unit tests pass (16 suites, no database-dependent failures). The database-dependent suites (integration, schema, prior acceptance tests) require POSTGRES_URL and are expected to be skipped locally; they pass in CI as confirmed by the green Migration Test job.

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| AC-1 | `express-rate-limit` installed as a production dependency in `backend/package.json` | PASS | `package.json` `dependencies["express-rate-limit"]` = `"^7.4.0"`. Not in `devDependencies`. `package-lock.json` contains `node_modules/express-rate-limit` at version `7.5.1`. Acceptance test (2 cases) pass. |
| AC-2 | `POST /api/auth/login` rate-limited to 10 req/15-min/IP; exceeding limit returns HTTP 429 with clear error message | PASS | 10 requests within window all succeed (not 429); 11th returns 429; body contains `{ error: 'Too many requests, please try again later' }`; boundary verified (10th not prematurely blocked); counter decrement verified (RateLimit-Remaining decreases each request). 5 tests pass. Confirmed active on staging: first 9 requests return 401, 10th returns 429. |
| AC-3 | `POST /api/auth/register` rate-limited to 10 req/15-min/IP; exceeding limit returns HTTP 429 with clear error message | PASS | Same pattern as AC-2 on the register endpoint. 10 within window succeed; 11th returns 429 with clear error message; boundary verified; register counter confirmed independent of login counter. 5 tests pass. |
| AC-4 | `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers present; `X-RateLimit-*` legacy headers absent | PASS | All three standard headers present on both `/api/auth/login` and `/api/auth/register` responses. `RateLimit-Limit` = `10` (matches `/^10/`). `RateLimit-Remaining` = 9 on first request. `X-RateLimit-*` headers absent. Confirmed on staging: headers `ratelimit-limit: 10`, `ratelimit-policy: 10;w=900`, `ratelimit-remaining: 9`, `ratelimit-reset: 900` present on first probe response. 12 tests pass. |
| AC-5 | Rate limiter uses the default in-memory store | PASS | `authRateLimiter` exported as a function with arity 3. Source inspection confirms `rateLimiter.js` imports only `express-rate-limit` — no Redis, ioredis, or pg-rate-limit imports. 2 tests pass. |
| AC-6 | Existing authentication tests continue to pass (no regressions) | PASS | CI run 23376388683: all five jobs green. Unit Tests job: all unit tests pass including `rateLimiter.test.js`. Migration Test job: full suite passes after fresh migrations (the `skip: NODE_ENV === test` fix resolves the prior interference). Local: `POST /api/auth/login` returns 200 within window; `POST /api/auth/register` returns 201 within window; `/api/auth/logout` is not rate-limited. 3 tests pass. |

---

## CI Status

| Job | Status | Notes |
|---|---|---|
| Lint | PASS | Pre-existing lint warnings in `searchService.js`, `emailService.js`, `authService.js` (stub files for TASK-014/015, not introduced by TASK-024). |
| Unit Tests | PASS | All unit tests pass, including `rateLimiter.test.js`. Module resolution error resolved by commit `c9d19dc`. |
| Integration Tests | PASS | All integration tests pass. |
| Migration Test | PASS | Full suite passes after migrations. Rate limiter test interference resolved by commit `3a6991f` (`skip: NODE_ENV === test`). |
| Build Docker Image | PASS | Image built and pushed to `ghcr.io/loskylp/braindump:staging`. Watchtower has pulled the new image. |

**Run ID:** 23376388683
**Commits:** `c9d19dc`, `3a6991f`
**CI URL:** https://github.com/loskylp/BrainDump/actions/runs/23376388683

---

## Staging

`GET https://braindump.staging.nxlabs.cc/api/health` returns **HTTP 200 `{"status":"ok","db":"connected"}`**.

Live rate-limit verification:

- First probe request to `POST /api/auth/login` returned `ratelimit-limit: 10`, `ratelimit-remaining: 9`, `ratelimit-reset: 900` — limiter is active (`NODE_ENV=production` causes `skip()` to return `false`).
- Sequential probes: requests 1–9 returned 401 (within window); request 10 returned 429 (app-level limit enforced).
- Subsequent requests returned 403 from Traefik (infrastructure-level block after repeated auth failures).

The `skip: () => process.env.NODE_ENV === 'test'` fix does not affect production because `NODE_ENV` is set to `production` in the staging `.env` (confirmed by header presence — a skipped limiter would emit no `RateLimit-*` headers).

---

## `skip` Fix Safety Analysis

The `skip: () => process.env.NODE_ENV === 'test'` bypass is correct and safe:

- In `NODE_ENV=test` (CI unit/migration jobs, local test runs): `skip()` returns `true`. The limiter passes all requests through without counting. This prevents the shared in-memory counter from tripping mid-suite when multiple test suites make more than 10 auth calls in one Jest worker.
- In `NODE_ENV=production` (staging, production): `skip()` returns `false`. The limiter counts and enforces normally. Confirmed by `RateLimit-*` headers present on staging responses.
- Unit tests for rate-limit behaviour (`backend/tests/unit/rateLimiter.test.js`) construct fresh `rateLimit()` instances directly — they do not import the `authRateLimiter` singleton — so the skip bypass does not reduce unit test coverage of the limiter logic.

No security regression from this fix.

---

## Test Suite Summary

### TASK-024 — Verifier acceptance tests

| File | Tests | Passed | Failed | AC coverage |
|---|---|---|---|---|
| `backend/tests/acceptance/TASK-024-rate-limiting-verifier.test.js` | 27 | 27 | 0 | AC-1 (2), AC-2 (5), AC-3 (5), AC-4 (12), AC-5 (2), AC-6 (3) |

**Test location:** `/Users/pablo/projects/Nexus/NexusTests/BrainDump/backend/tests/acceptance/TASK-024-rate-limiting-verifier.test.js`

### Prior regression (local, database-independent suites only)

| Suite | Result | Notes |
|---|---|---|
| All backend unit tests (16 suites) | 203/203 PASS | Includes `rateLimiter.test.js` (17 tests). |
| Database-dependent suites (integration, schema, TASK-002 through TASK-009 acceptance) | SKIP (no POSTGRES_URL) | Pre-existing requirement. Pass in CI migration-test job confirmed green. |

---

## Observations

**OBS-TASK024-02 (lint warnings, pre-existing):** The lint job reports unused variables in `backend/src/services/searchService.js`, `backend/src/services/emailService.js`, `backend/src/services/authService.js`, and `backend/src/routes/search.js`. These are stub files for TASK-014 and TASK-015 (search, password reset) not yet implemented. Not introduced by TASK-024. No action required for this task.

**OBS-TASK024-03 (Traefik-level rate limiting in staging):** During the live staging probe, the verifier's outbound IP received 403 Forbidden from Traefik after 10+ repeated auth requests within a short window. This is the expected and correct behaviour — the infrastructure layer provides an additional rate-limiting tier above the application layer. The 403 is issued by Traefik (content-type: text/plain, no `RateLimit-*` headers), distinct from the application's 429 (content-type: application/json, includes `RateLimit-*` headers). Defense-in-depth working as intended.
