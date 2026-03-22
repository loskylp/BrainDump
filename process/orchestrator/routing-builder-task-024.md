# Routing Instruction -- Builder
**Task:** TASK-024 | **Iteration:** 1 of 3
**Date:** 2026-03-21 | **From:** Orchestrator | **To:** Builder

---

## Context

TASK-024 addresses SEC-001 (High severity) from the Cycle 1 Sentinel security report: no rate limiting exists on authentication endpoints. This was deferred from Cycle 1 and is the first task in Cycle 2. It is a P1 security hardening task with Low risk.

The Scaffolder has already prepared:
- `backend/src/middleware/rateLimiter.js` -- stub file with full configuration contract (currently exports `authRateLimiter = null`)
- `backend/src/routes/auth.js` -- commented-out import and TODO markers for applying rate limiter to `/login` and `/register`
- `backend/package.json` -- `express-rate-limit: ^7.4.0` added to dependencies but **not installed**

## What to Build

Implement rate limiting on `POST /api/auth/login` and `POST /api/auth/register` using `express-rate-limit`.

### Step 1: Install the dependency
Run `npm install` in `backend/` to install `express-rate-limit` (already in package.json).

### Step 2: Implement `backend/src/middleware/rateLimiter.js`
Replace the `null` stub with a configured `rateLimit()` instance:
- `windowMs`: `15 * 60 * 1000` (15-minute window)
- `max`: `10` (requests per window per IP)
- `standardHeaders`: `true` (emit `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`)
- `legacyHeaders`: `false` (suppress `X-RateLimit-*`)
- `message`: `{ error: 'Too many requests, please try again later' }`
- `keyGenerator`: `(req) => req.ip` (default)
- Store: default in-memory (do not configure an external store)

### Step 3: Apply the middleware in `backend/src/routes/auth.js`
- Uncomment the import: `const { authRateLimiter } = require('../middleware/rateLimiter');`
- Apply `authRateLimiter` as middleware on `POST /register` and `POST /login` routes
- Remove the TODO comments related to TASK-024

### Step 4: Write tests
Write tests that verify:
- AC-1: `express-rate-limit` is in `backend/package.json` dependencies (can verify via require)
- AC-2: `POST /api/auth/login` returns 429 after 10 requests in a 15-minute window; the 429 body contains `{ error: 'Too many requests, please try again later' }`
- AC-3: `POST /api/auth/register` returns 429 after 10 requests in a 15-minute window; the 429 body contains `{ error: 'Too many requests, please try again later' }`
- AC-4: Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are present in responses to rate-limited endpoints
- AC-5: In-memory store is used (default -- no external store configured)
- AC-6: Existing authentication tests continue to pass (run the full backend test suite and confirm no regressions)

**Test location:** `backend/tests/unit/rateLimiter.test.js` for unit tests; acceptance tests can be placed in `backend/tests/acceptance/` if they require a running server.

**Important:** The rate limiter uses an in-memory store that persists across requests within the same process. In tests, you will need to either:
- Create a fresh rate limiter instance per test, OR
- Reset the rate limiter store between tests, OR
- Use separate Express app instances per test group

to avoid test pollution where one test's requests count against another test's rate limit.

## Acceptance Criteria (from Task Plan)

1. `express-rate-limit` is installed as a production dependency in `backend/package.json`
2. `POST /api/auth/login` is rate-limited to 10 requests per 15-minute window per IP address; exceeding the limit returns HTTP 429 with a clear error message
3. `POST /api/auth/register` is rate-limited to 10 requests per 15-minute window per IP address; exceeding the limit returns HTTP 429 with a clear error message
4. Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are included in responses to rate-limited endpoints
5. Rate limiter uses the default in-memory store (acceptable for single-instance deployment per ADR-001)
6. Existing authentication tests continue to pass (no regressions)

## Files to Touch

| File | Action |
|---|---|
| `backend/src/middleware/rateLimiter.js` | Implement (replace stub) |
| `backend/src/routes/auth.js` | Modify (uncomment import, apply middleware) |
| `backend/tests/unit/rateLimiter.test.js` | Create (unit tests) |
| `backend/tests/acceptance/TASK-024-rate-limiting.test.js` | Create (acceptance tests, optional) |

## Constraints

- Do NOT modify any other routes or middleware beyond what is specified
- Do NOT add Redis or any external store -- use the default in-memory store
- Do NOT change the rate limit values (10 requests, 15-minute window) -- these come from SEC-001 and ADR-002
- Ensure `trust proxy` is already set in `app.js` (it should be from TASK-001) -- verify but do not change
- Use lowercase `common` in any import paths (case-sensitive CI environment)

## Commit Convention

Commit message: `TASK-024: Rate limiting on auth endpoints -- [summary of what was done]`

Push to `main` branch after committing.

## Handoff

After completing implementation and tests, provide:
1. What was built (files changed/created)
2. Test results (all tests passing, count)
3. Any deviations from this routing instruction
4. Any observations or concerns
