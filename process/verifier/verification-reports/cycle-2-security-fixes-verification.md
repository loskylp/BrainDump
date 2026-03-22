# Verification Report — Cycle 2 Security Fixes

**Items under verification:** SEC-002, SEC-004, SEC-005, SEC-007, SEC-013
**Commit:** dc1c5c0
**Date:** 2026-03-21
**Verifier invocation:** Initial verification (no prior report for this batch)
**Verdict: FAIL**

---

## Summary

3 of 5 security fixes are correctly implemented and verified. SEC-013 introduces a regression that breaks 12 TASK-009 acceptance tests in CI (Migration Test job). The fix makes `updateNote` attempt a folder ownership query when `folderId` is `undefined` — a state that occurs on every normal note save that does not include a `folderId` field in the request body.

---

## Fix-by-Fix Results

### SEC-002 — Request body size limit

**Criterion:** `express.json({ limit: '1mb' })` in `app.js`

**Finding:** PASS

File: `backend/src/app.js` line 71.

```
app.use(express.json({ limit: '1mb' }));
```

The comment on that line explicitly names SEC-002. The limit is set to `1mb` as required. No other body parser middleware is present that could bypass this limit.

---

### SEC-004 — SESSION_SECRET startup guard

**Criterion:** Guard throws if `SESSION_SECRET` is missing AND `NODE_ENV !== 'test'`. Does not throw in test environment. Does not break existing auth tests.

**Finding:** PASS

File: `backend/src/config/session.js` lines 44–46.

```javascript
if (!process.env.SESSION_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error('SESSION_SECRET environment variable is required in non-test environments');
}
```

Unit test coverage: `tests/unit/session.config.test.js` — 4 tests, all passing in both local and CI (Unit Tests job green).

- Throws in `NODE_ENV=production` when secret absent: verified
- Does not throw in `NODE_ENV=production` when secret present: verified
- Throws in `NODE_ENV=development` when secret absent: verified
- Does not throw in `NODE_ENV=test` even when secret absent: verified

Existing auth tests are unaffected: the test environment sets `NODE_ENV=test`, so the guard is bypassed and the fallback `'dev-secret-change-in-production'` is used.

---

### SEC-005 — clearCookie security flags on logout

**Criterion:** `clearCookie` on `/api/auth/logout` (and `/api/auth/account`) includes `httpOnly`, `secure` (production only), `sameSite: 'strict'`, `path: '/'`.

**Finding:** PASS

File: `backend/src/routes/auth.js`.

Logout route (lines 152–157):
```javascript
res.clearCookie('connect.sid', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});
```

Account deletion route (lines 320–325): identical options applied.

All four required attributes are present. `secure` is conditioned on `NODE_ENV === 'production'` consistent with the cookie creation policy in `session.js`.

---

### SEC-007 — 500 responses do not expose internal error details

**Criterion:** 500 responses return generic `'Internal server error'` message; `err.message` is not sent to the client.

**Finding:** PASS

File: `backend/src/app.js` lines 130–143 (central error handler).

```javascript
app.use((err, req, res, _next) => {
  const status = ERROR_MAP[err.code] || ERROR_MAP[err.message] || 500;
  const isServerError = status === 500;

  if (isServerError) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({
    error: isServerError ? 'INTERNAL_ERROR' : (err.code || err.message || 'INTERNAL_ERROR'),
    message: isServerError ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});
```

When `isServerError` is true: `error` is hardcoded to `'INTERNAL_ERROR'`, `message` is hardcoded to `'Internal server error'`. Internal `err.message` (Sequelize messages, stack traces, column names) is only sent to `console.error` server-side.

The TASK-009 CI failure confirms this path works as coded — when `updateNote` throws a Sequelize error, the client receives `{"error": "INTERNAL_ERROR", "message": "Internal server error"}` — which is SEC-007 working correctly. The problem is that the error is being thrown where it should not be.

---

### SEC-013 — Folder ownership validation in updateNote

**Criterion:** `updateNote` checks folder ownership when `folderId` is provided (non-null). Uses `Folder.scope forUser` pattern consistent with `createNote`.

**Finding: FAIL — regression introduced**

File: `backend/src/services/noteService.js` lines 171–178.

```javascript
if (Object.prototype.hasOwnProperty.call(updates, 'folderId') && updates.folderId !== null) {
  const folder = await Folder.scope({ method: ['forUser', userId] }).findOne({
    where: { id: updates.folderId },
    transaction,
  });
  if (!folder) {
    throw new Error('FOLDER_NOT_FOUND');
  }
}
```

The folder ownership check is logically correct when `updates.folderId` is a valid UUID or `null`. However, the route handler in `notes.js` (lines 108–109) always passes `folderId` as a key in the updates object:

```javascript
const { title, body, folderId } = req.body;
const note = await noteService.updateNote(req.params.id, req.session.userId, { title, body, folderId });
```

When a PUT request body does not include a `folderId` field, destructuring sets `folderId = undefined`. The object literal `{ title, body, folderId }` creates a key `folderId` with value `undefined`. `Object.prototype.hasOwnProperty.call` returns `true` for explicitly included keys, even when the value is `undefined`. Then `updates.folderId !== null` evaluates to `true` because `undefined !== null`.

This causes `updateNote` to execute:
```javascript
Folder.scope({ method: ['forUser', userId] }).findOne({ where: { id: undefined }, ... })
```

Sequelize rejects this with: `WHERE parameter "id" has invalid "undefined" value`.

The error propagates to the SEC-007 handler as a 500, which is correct behavior for an unhandled error — but the root cause is that the guard fires on every PUT request that does not include `folderId`.

**Regression evidence:** TASK-009 acceptance tests passed in CI run 23388663301 (TASK-026 commit, all 5 jobs green). They fail in CI run 23388901400 (this security commit, Migration Test FAIL). 12 tests fail in `tests/acceptance/TASK-009-edit-note-verifier.test.js`. All failures receive HTTP 500 where 200 is expected. The console logs in CI confirm `WHERE parameter "id" has invalid "undefined" value`.

**Fix required (for Builder):** The route handler should not pass `folderId` as a key when it is absent from the request body. One correct approach: only include `folderId` in `updates` if it is present in `req.body`:

```javascript
const updates = {};
if (req.body.title !== undefined) updates.title = req.body.title;
if (req.body.body !== undefined) updates.body = req.body.body;
if (Object.prototype.hasOwnProperty.call(req.body, 'folderId')) updates.folderId = req.body.folderId;
```

An alternative is to change the guard condition in `noteService.updateNote` to treat `undefined` as "not provided":

```javascript
if (Object.prototype.hasOwnProperty.call(updates, 'folderId')
    && updates.folderId !== null
    && updates.folderId !== undefined) {
```

Either fix is sufficient. The route-layer fix is preferred because it correctly distinguishes "field not in request" from "field explicitly set to null", which has semantic meaning (null = move to root).

---

## CI Results

| Job | Result | Notes |
|---|---|---|
| Unit Tests | PASS | 263 tests reported; 1 flaky socket hang-up in `notesRoute.deleteNote.test.js` passes in isolation — not caused by Cycle 2 changes |
| Lint | PASS | 1 unused-variable warning in `database.js` (pre-existing) |
| Integration Tests | PASS | All integration tests green |
| Migration Test | FAIL | 12 tests in `TASK-009-edit-note-verifier.test.js` fail with HTTP 500 |
| Build Docker Image | NOT RUN | Skipped due to Migration Test failure |

CI run: https://github.com/loskylp/BrainDump/actions/runs/23388901400

---

## Staging Health

```
GET https://braindump.staging.nxlabs.cc/api/health
{"status":"ok","db":"connected"}
```

Staging is up. Note: staging has not been redeployed with the security commit (Docker build was skipped due to CI failure), so staging still runs the previous image.

---

## Local Unit Test Run

```
Tests: 1 failed (flaky socket hang-up), 262 passed, 263 total
```

The `notesRoute.deleteNote.test.js` failure ("socket hang up") is a pre-existing test harness timing issue: the test passes consistently when run in isolation (`npx jest --testPathPattern notesRoute.deleteNote` — 9/9 pass). It is not caused by any Cycle 2 change.

---

## Observations (non-blocking)

1. The `isProduction` variable in `backend/src/config/database.js` line 30 is unused — flagged by the lint job as a warning. Pre-existing; not introduced by Cycle 2.

2. The duplicate JSDoc block on `DELETE /api/auth/account` in `auth.js` (lines 263–290 duplicate lines 237–261 with minor differences) is a stale documentation issue. The second block has updated return code descriptions; the first should be removed.

---

## Required Action

**SEC-013 regression must be fixed before this batch can be marked PASS.**

Route: `backend/src/routes/notes.js` — PUT `/api/notes/:id` handler.
Service: `backend/src/services/noteService.js` — `updateNote` guard condition.

Fix the `undefined` folderId case so that PUT requests without a `folderId` field in the body do not trigger the folder ownership query.

After the fix, re-run:
1. `npm run test:unit` — confirm `session.config.test.js` (4 tests) and `noteService.updateNote.test.js` (7 tests) still pass
2. Full acceptance suite in CI — confirm Migration Test passes with TASK-009 tests green
3. Confirm no new failures in any of the 5 CI jobs
