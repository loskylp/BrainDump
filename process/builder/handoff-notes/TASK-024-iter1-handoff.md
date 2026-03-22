# Builder Handoff Note — TASK-024 (Iteration 1)

**Task:** TASK-024 — Rate limiting on authentication endpoints
**Date:** 2026-03-21
**Builder iteration:** 1 of 3
**Status:** Complete — all unit tests pass, pushed to main

---

## What Was Built

### Files changed

| File | Action |
|---|---|
| `backend/src/middleware/rateLimiter.js` | Implemented — replaced `null` stub with a configured `rateLimit()` instance |
| `backend/src/routes/auth.js` | Modified — uncommented import, applied `authRateLimiter` to POST /register and POST /login, removed TASK-024 TODO comments |
| `backend/tests/unit/rateLimiter.test.js` | Created — 17 unit tests covering AC-2, AC-3, AC-4, and module contract |
| `backend/package-lock.json` | Updated — `npm install` resolved `express-rate-limit@^7.4.0` |

### Implementation summary

`authRateLimiter` is a `rateLimit()` instance configured with:
- `windowMs`: 900,000 ms (15 minutes)
- `max`: 10
- `standardHeaders`: `true` (emits `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`)
- `legacyHeaders`: `false` (suppresses `X-RateLimit-*`)
- `message`: `{ error: 'Too many requests, please try again later' }`
- `keyGenerator`: `(req) => req.ip` (default)
- Store: default in-memory (no external store)

The middleware is applied as the first handler on both `router.post('/register', authRateLimiter, ...)` and `router.post('/login', authRateLimiter, ...)`.

`app.set('trust proxy', 1)` was already present in `app.js` — no change required.

---

## Test Results

**Unit tests:** 176 passed, 0 failed across 15 test suites.

New test coverage in `rateLimiter.test.js` (17 tests):

| Criteria | Tests | Result |
|---|---|---|
| AC-2: /login returns 429 after 10 requests | 4 | Pass |
| AC-3: /register returns 429 after 10 requests | 3 | Pass |
| AC-4: RateLimit-* headers present in responses | 8 | Pass |
| Module contract (non-null, arity 3) | 2 | Pass |

**Acceptance tests:** Pre-existing failures (require `POSTGRES_URL` — no database in this environment). Unaffected by this change. These were failing before TASK-024 and continue to fail for the same reason.

---

## Test isolation strategy

Each test `describe` block that exercises the rate limit creates a fresh `rateLimit()` instance (via `makeFreshLimiter()`) in a `beforeEach`. The production `authRateLimiter` singleton is not used directly in the rate-exhaustion tests — this avoids in-memory store pollution across test runs. The module contract tests (`typeof authRateLimiter === 'function'`, `arity === 3`) do import the production export directly; they make no requests so they do not affect the store.

---

## Deviations from routing instruction

None. All specified configuration values, file paths, and constraints were followed exactly.

---

## Observations

- The `express-rate-limit` v7 `standardHeaders: true` option emits the header as a structured policy string (e.g., `10; w=900`) in addition to the plain integer form. The `RateLimit-Limit header value is 10` test uses `.toMatch(/^10/)` to handle both forms without hardcoding the format.
- The acceptance test suite (`tests/acceptance/`) is outside the Builder's scope per the task constraints. No acceptance tests were written for TASK-024. The routing instruction noted this was optional.
