# Security Report -- BrainDump
**Date:** 2026-03-21 | **Environment:** code review (no staging deployed) | **Result:** FINDINGS
**Test scope:** Backend routes, services, middleware, session configuration, frontend API client and rendering layer, dependency manifests. Attack categories: injection, broken authentication, broken access control (IDOR), security misconfiguration, XSS, sensitive data exposure.

---

## Findings

### SEC-001: No rate limiting on authentication endpoints -- DEFERRED TO CYCLE 2
**Severity:** High
**Category:** Broken Authentication (OWASP A07:2021)
**Affected:** `POST /api/auth/login`, `POST /api/auth/register`
**Evidence:** The backend has no rate-limiting middleware anywhere in the dependency tree (`express-rate-limit` is absent from `backend/package.json`). Login and registration endpoints accept unlimited requests. An attacker can brute-force passwords or create accounts at arbitrary speed.
**Expected behaviour:** Authentication endpoints should enforce a per-IP or per-account rate limit (e.g., 5 failed login attempts per 15 minutes per IP/email combination).
**Remediation:** Install `express-rate-limit` (or equivalent). Apply a strict limiter to `/api/auth/login` and `/api/auth/register`. Example configuration: `windowMs: 15 * 60 * 1000, max: 10` for login. Consider stricter limits for registration to prevent mass account creation.
**Status:** DEFERRED TO CYCLE 2 -- Tracked as TASK-024 in the task plan. Will be addressed as a priority task in Cycle 2 execution.

---

### SEC-002: No request body size limit on `express.json()`
**Severity:** Medium
**Category:** Security Misconfiguration (OWASP A05:2021)
**Affected:** `backend/src/app.js` line 65: `app.use(express.json())`
**Evidence:** `express.json()` is called without a `limit` option. The Express default is `100kb`, which is reasonable for most payloads. However, the note `body` field is `TEXT` (unbounded) and there is no application-level validation of body length on `PUT /api/notes/:id` or `POST /api/notes`. A user could submit multi-megabyte note bodies, bounded only by Express's 100kb default. If the default is ever changed or overridden, this becomes a resource exhaustion vector.
**Expected behaviour:** Explicit body size limit configured, and application-level validation of note body length.
**Remediation:** Set `app.use(express.json({ limit: '500kb' }))` explicitly so the limit is documented and intentional. Add a maximum note body length validation in `noteService.updateNote` and `noteService.createNote` (e.g., 200kb) and return 400 if exceeded.

---

### SEC-003: Missing `.gitignore` -- risk of committing secrets -- RESOLVED
**Severity:** High
**Category:** Sensitive Data Exposure (OWASP A02:2021)
**Affected:** Project root `/Users/pablo/projects/Nexus/NexusTests/BrainDump/`
**Evidence:** No `.gitignore` file exists anywhere in the repository. The `.env` file containing `POSTGRES_URL`, `SESSION_SECRET`, and `EMAIL_API_KEY` is currently untracked (confirmed via `git ls-files --error-unmatch .env`), but it appears as an untracked file in `git status`. The `backend/node_modules/` and `frontend/node_modules/` directories also appear as untracked. Any `git add .` or `git add -A` would commit all of these.
**Expected behaviour:** A `.gitignore` file should exclude `.env`, `node_modules/`, `dist/`, and other non-source artefacts.
**Remediation:** Create a `.gitignore` at the project root with at minimum:
```
.env
node_modules/
dist/
.vite/
```
**Resolution:** RESOLVED on 2026-03-21. A `.gitignore` file was created at the project root excluding `.env`, `.env.*`, `node_modules/`, `dist/`, `.vite/`, OS files, editor directories, log files, and coverage directories. Verified: `git status` no longer shows `.env`, `node_modules/`, `dist/`, or `.vite/` as untracked files.

---

### SEC-004: Session secret has a hardcoded fallback
**Severity:** Medium
**Category:** Security Misconfiguration (OWASP A05:2021)
**Affected:** `backend/src/config/session.js` line 46: `secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production'`
**Evidence:** If `SESSION_SECRET` is not set in the environment, the session middleware silently falls back to the hardcoded string `'dev-secret-change-in-production'`. In a misconfigured production deployment, all session cookies would be signed with a publicly known secret, allowing session forgery.
**Expected behaviour:** The application should refuse to start if `SESSION_SECRET` is not set in production.
**Remediation:** Add an early startup check in `session.js` or `server.js`:
```js
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production');
}
```

---

### SEC-005: Logout `clearCookie` does not set `secure` flag, missing `path`
**Severity:** Low
**Category:** Security Misconfiguration (OWASP A05:2021)
**Affected:** `backend/src/routes/auth.js` lines 149-152
**Evidence:** The `clearCookie` call sets `httpOnly: true` and `sameSite: 'strict'` but omits the `secure` flag and `path`. For `clearCookie` to work correctly, the options must exactly match the options used to set the cookie (except `maxAge`/`expires`). The session middleware sets `secure: isProduction`, but the `clearCookie` call always omits `secure`. In production (where the cookie was set with `secure: true`), the browser may not clear it because the attributes do not match. Similarly, if `path` differs, the cookie persists.
**Expected behaviour:** `clearCookie` options should mirror the session cookie options: `{ httpOnly: true, sameSite: 'strict', secure: isProduction, path: '/' }`.
**Remediation:** Update the `clearCookie` call to include `secure` and `path` matching the session cookie configuration.

---

### SEC-006: `ownershipGuard` does not validate UUID format of route parameters
**Severity:** Low
**Category:** Injection / Input Validation (OWASP A03:2021)
**Affected:** `backend/src/middleware/ownershipGuard.js` line 60: `Model.findByPk(resourceId)`
**Evidence:** The `resourceId` value from `req.params` is passed directly to `Model.findByPk()` without validating that it is a well-formed UUID. If a non-UUID string is passed (e.g., `/api/notes/../../something`), Sequelize will issue a database query with that value. Sequelize parameterises the query, so there is no SQL injection risk. However, malformed input causes unnecessary database round-trips and may produce confusing Sequelize/PostgreSQL cast errors (e.g., `invalid input syntax for type uuid`) that leak through the error handler as 500 responses.
**Expected behaviour:** Route parameters used as UUIDs should be validated before database lookup.
**Remediation:** Add a UUID format check early in `ownershipGuard`:
```js
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(resourceId)) {
  return sendNotFound(res);
}
```

---

### SEC-007: Error handler leaks internal error messages on 500 responses
**Severity:** Medium
**Category:** Security Misconfiguration (OWASP A05:2021)
**Affected:** `backend/src/app.js` lines 124-136
**Evidence:** The centralised error handler returns `err.message` in the JSON response body for all status codes including 500:
```js
res.status(status).json({
  error: err.code || err.message || 'INTERNAL_ERROR',
  message,
});
```
When `status === 500`, this could expose internal error details such as Sequelize error messages, database connection strings in error text, or stack-trace fragments. The `console.error` on line 129 correctly logs the error server-side, but the response should not echo internal details.
**Expected behaviour:** 500 responses should return a generic message like `"Internal server error"` without echoing the original error.
**Remediation:** Change the error handler to sanitise 500 responses:
```js
if (status === 500) {
  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
}
```

---

### SEC-008: CORS allows any origin in non-production environments
**Severity:** Low
**Category:** Security Misconfiguration (OWASP A05:2021)
**Affected:** `backend/src/app.js` lines 59-62
**Evidence:** `origin: process.env.NODE_ENV === 'production' ? false : true` -- in `development`, `staging`, and `test` environments, CORS is fully permissive (`origin: true` reflects the request Origin). If the staging environment is accessible on a network (not just localhost), any website can make credentialed cross-origin requests to the staging API.
**Expected behaviour:** Staging should use a restrictive CORS origin list, not a fully open one. Only development (localhost) should use permissive CORS.
**Remediation:** Restrict CORS in staging:
```js
origin: isProduction ? false : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
```

---

### SEC-009: `NoteVersion` ownership is verified via note lookup, but `getVersion` fetches version without note ownership lock
**Severity:** Informational
**Category:** Broken Access Control (OWASP A01:2021)
**Affected:** `backend/src/services/versionService.js` lines 121-144 (`getVersion`)
**Evidence:** `getVersion` correctly verifies note ownership via `Note.scope({ method: ['forUser', userId] }).findOne(...)`, then fetches the `NoteVersion` by `id` and checks `version.note_id !== noteId`. However, the version lookup on line 131 uses `NoteVersion.findOne({ where: { id: versionId } })` without the RLS-scoped note join. This is not a vulnerability because: (a) the note ownership check on line 122-128 gates the entire flow, and (b) RLS on `note_versions` enforces the subquery filter at the DB level. The dual check is defence-in-depth. However, if RLS were ever misconfigured, the version lookup alone would not enforce ownership.
**Expected behaviour:** No action required. This is an observation for defence-in-depth awareness.
**Remediation:** None required. The existing layered approach (app-level note ownership check + DB-level RLS) is sound. If a future refactor removes RLS, the version query should be updated to join through the note table.

---

### SEC-010: `markdown-it` with `linkify: true` can render clickable phishing links
**Severity:** Low
**Category:** Cross-Site Scripting / Content Injection (OWASP A03:2021)
**Affected:** `frontend/src/components/editor/Preview.jsx` line 41: `linkify: true`
**Evidence:** `markdown-it` with `linkify: true` auto-converts bare URLs into `<a href="...">` tags. While `html: false` correctly prevents raw HTML injection, a user's own note content could contain phishing URLs that render as clickable links. In a single-user note-taking app this is self-XSS only (the user is attacking themselves). However, if sharing or collaboration is added in a future cycle, this becomes a vector for content-based phishing.
**Expected behaviour:** This is acceptable for the current single-user model. Flag for review if multi-user sharing is introduced.
**Remediation:** No immediate action. When/if collaboration or note sharing is introduced, add `linkify: false` or a link sanitiser that adds `rel="noopener noreferrer"` and displays the actual URL domain.

---

### SEC-011: `dangerouslySetInnerHTML` used in Preview -- safe only while `html: false` is maintained
**Severity:** Informational
**Category:** Cross-Site Scripting (OWASP A03:2021)
**Affected:** `frontend/src/components/editor/Preview.jsx` line 69
**Evidence:** The Preview component uses `dangerouslySetInnerHTML={{ __html: html }}` to render markdown-it output. This is safe because `markdown-it` is configured with `html: false`, which escapes raw HTML in the source. The security of this component is entirely dependent on that configuration option remaining `false`. If any future change sets `html: true`, stored XSS becomes possible.
**Expected behaviour:** Current configuration is correct. This is flagged as a guardrail awareness item.
**Remediation:** Add a code comment (already present) and consider adding a unit test that asserts raw HTML in markdown input is escaped in the output.

---

### SEC-012: Version restore creates a pre-restore snapshot but does not validate restored content
**Severity:** Informational
**Category:** Broken Access Control (OWASP A01:2021)
**Affected:** `backend/src/services/versionService.js` lines 156-215 (`restoreVersion`)
**Evidence:** The `restoreVersion` function correctly verifies note ownership and version-note relationship. It creates a new version snapshot of the current state before overwriting the note with the target version's content. The `SELECT FOR UPDATE` lock prevents concurrent race conditions. The implementation is sound. No vulnerability found in the restore flow.
**Expected behaviour:** Current implementation is correct.
**Remediation:** None required.

---

## Dependency Audit Summary

All dependencies were reviewed against their latest versions, known CVE databases, and license compatibility.

### Backend Dependencies

| Package | Version | License | Known CVEs | Maintenance | Verdict |
|---|---|---|---|---|---|
| bcryptjs | ^2.4.3 | MIT | None known | Stable, low-frequency maintenance | APPROVE |
| connect-pg-simple | ^9.0.1 | MIT | None known | Active | APPROVE |
| cors | ^2.8.5 | MIT | None known | Stable | APPROVE |
| dotenv | ^16.4.5 | BSD-2-Clause | None known | Active | APPROVE |
| express | ^4.18.3 | MIT | None known at this version | Active | APPROVE |
| express-session | ^1.18.0 | MIT | None known | Active | APPROVE |
| helmet | ^7.1.0 | MIT | None known | Active | APPROVE |
| pg | ^8.11.3 | MIT | None known | Active | APPROVE |
| pg-hstore | ^2.3.4 | MIT | None known | Low maintenance | APPROVE |
| sequelize | ^6.37.1 | MIT | None known at this version | Active | APPROVE |
| uuid | ^9.0.1 | MIT | None known | Active | APPROVE |

### Frontend Dependencies

| Package | Version | License | Known CVEs | Maintenance | Verdict |
|---|---|---|---|---|---|
| @codemirror/* | ^6.x | MIT | None known | Active | APPROVE |
| @uiw/react-codemirror | ^4.21.24 | MIT | None known | Active | APPROVE |
| codemirror | ^6.0.1 | MIT | None known | Active | APPROVE |
| markdown-it | ^14.1.0 | MIT | None known | Active | APPROVE |
| react | ^18.3.1 | MIT | None known | Active | APPROVE |
| react-dom | ^18.3.1 | MIT | None known | Active | APPROVE |
| react-router-dom | ^6.23.1 | MIT | None known | Active | APPROVE |

All dependencies: APPROVE. No rejections. All licenses are MIT or BSD-2-Clause, fully compatible with the project.

---

## Coverage Summary

| Attack category | Tested | Findings |
|---|---|---|
| Injection (SQL, NoSQL) | Yes | 0 -- Sequelize parameterised queries used throughout |
| Broken Authentication | Yes | 1 (SEC-001: no rate limiting) |
| Broken Access Control / IDOR | Yes | 0 -- ownership guard + forUser scope + RLS provide 3-layer defence |
| Security Misconfiguration | Yes | 4 (SEC-002, SEC-004, SEC-007, SEC-008) |
| Sensitive Data Exposure | Yes | 1 (SEC-003: missing .gitignore) |
| Cross-Site Scripting (XSS) | Yes | 0 -- markdown-it html:false is effective |
| Insecure Deserialization | N/A | Not applicable (JSON body parsing only) |
| Components with Known Vulns | Yes | 0 -- no known CVEs in dependency tree |
| Session Management | Yes | 2 (SEC-004, SEC-005) |
| Version History Feature | Yes | 0 -- restore flow is correctly implemented |

---

## Recommendation

**RETURN TO BUILDER** -- 2 High severity findings must be resolved before Demo Sign-off:

1. **SEC-001 (High):** ~~No rate limiting on authentication endpoints.~~ DEFERRED TO CYCLE 2 -- Tracked as TASK-024. Install `express-rate-limit` and apply to `/api/auth/login` and `/api/auth/register`.

2. **SEC-003 (High):** ~~No `.gitignore` file.~~ RESOLVED -- `.gitignore` created on 2026-03-21.

After these two are resolved, the following Medium findings should be addressed:

3. **SEC-004 (Medium):** Session secret hardcoded fallback -- add startup guard for production.
4. **SEC-007 (Medium):** Error handler leaks internal error messages on 500 -- sanitise.
5. **SEC-002 (Medium):** No explicit body size limit -- make the Express default explicit.

Low and Informational findings (SEC-005, SEC-006, SEC-008, SEC-009, SEC-010, SEC-011, SEC-012) are tracked for future remediation but do not block Demo Sign-off.
