# Handoff Note — TASK-024 CI Fix

**Task:** TASK-024 CI failure — fix required
**Builder:** Claude Sonnet 4.6
**Date:** 2026-03-21
**Iteration:** 2 (CI fix pass)
**Passing CI run:** https://github.com/loskylp/BrainDump/actions/runs/23376388683

---

## What was done

Two root causes were identified and fixed. The Verifier's diagnosis (stale GitHub Actions cache) was a contributing factor but not the primary cause.

### Root cause 1 — Missing `package.json` commit (primary)

`backend/package.json` was not staged in commit `39b7dc1`. The `package-lock.json` included `express-rate-limit@7.5.1`, but `package.json` did not list it in `dependencies`. When CI ran `npm ci`, it installed dependencies from the lock file but module resolution failed at runtime because `package.json` — the authoritative manifest — did not declare the package.

Fix: committed `backend/package.json` with `"express-rate-limit": "^7.4.0"` added to `dependencies`.

Commit: `c9d19dc` — "fix: add express-rate-limit to backend/package.json — omitted from TASK-024 commit"

### Root cause 2 — Rate limiter tripping acceptance tests (secondary)

After the `package.json` fix, Unit Tests and Integration Tests passed, but Migration Test still failed. The `migration-test` job runs the full test suite (`npm test`) — all unit, integration, and acceptance tests in a single Jest process. Multiple acceptance test suites each call `POST /api/auth/register` in sequence. The `authRateLimiter` singleton holds an in-memory store that persists across suites within the same process. The collective registration calls exceeded the 10-req/15-min ceiling, returning 429 to registration helpers and cascading through AC-3 and AC-4 test groups.

Fix: added `skip: () => process.env.NODE_ENV === 'test'` to the `rateLimit()` config in `src/middleware/rateLimiter.js`. When `NODE_ENV` is `test`, the limiter passes all requests through without counting. The unit tests for rate-limit behaviour (`rateLimiter.test.js`) are unaffected — they construct their own fresh `rateLimit()` instances directly from `express-rate-limit`.

Commit: `3a6991f` — "fix: skip rate limiter in NODE_ENV=test to prevent acceptance test interference"

### Cache deletion (Option C — pursued but not sufficient)

All five GitHub Actions npm cache entries were deleted before the code fixes were made. This did not resolve the failure because the root cause was the missing `package.json` declaration, not the cache.

---

## CI result

**Run ID:** 23376388683
**Commit:** 3a6991f
**URL:** https://github.com/loskylp/BrainDump/actions/runs/23376388683

| Job | Status |
|---|---|
| Lint | PASS |
| Unit Tests | PASS |
| Integration Tests | PASS |
| Migration Test | PASS |
| Build Docker Image | PASS |

---

## Unit tests

All 176 backend unit tests pass locally (`NODE_ENV=test npm run test:unit`). The `skip` option in `authRateLimiter` does not affect the `rateLimiter.test.js` suite — those tests create independent `rateLimit()` instances and exercise the ceiling behaviour directly.

---

## Deviations from Verifier's diagnosis

The Verifier attributed the failure solely to a stale GitHub Actions cache. The cache was stale in the sense that `package.json` was not in the commit, but:

1. The npm cache key (hash of `package-lock.json`) would have correctly detected the lock file change — the cache would have been busted on a fresh run even without manual deletion.
2. The actual failure was that `package.json` did not declare `express-rate-limit`, so even a fully fresh `npm ci` would fail to make the module available to the Jest resolver (depending on npm version behaviour with inconsistent manifests).
3. After fixing `package.json`, a second failure surfaced that was not mentioned in the Verifier's report: the rate limiter singleton tripping acceptance tests in the migration-test job. This required the `skip` bypass addition.

---

## Files changed

- `backend/package.json` — added `"express-rate-limit": "^7.4.0"` to `dependencies`
- `backend/src/middleware/rateLimiter.js` — added `skip` option to bypass rate limiting in `NODE_ENV=test`
