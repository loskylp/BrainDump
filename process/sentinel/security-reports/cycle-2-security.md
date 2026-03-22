# Security Report -- BrainDump -- Cycle 2
**Date:** 2026-03-21 | **Environment:** Code review (no staging deployed for black-box testing) | **Result:** FINDINGS
**Profile:** Commercial | **Cycle:** 2 | **Continues from:** cycle-1-security.md (SEC-001 through SEC-012)

---

## New Findings (Cycle 2)

### SEC-013: updateNote does not validate folder ownership when setting folder_id -- IDOR
**Severity:** Medium
**Category:** Broken Access Control / IDOR (OWASP A01:2021)
**Affected:** `backend/src/services/noteService.js` lines 150-180 (`updateNote`), specifically line 172-173
**Evidence:**
The `createNote` function correctly validates folder ownership before associating a note with a folder (lines 41-48): it uses `Folder.scope({ method: ['forUser', userId] }).findOne(...)` to confirm the folder belongs to the requesting user. However, `updateNote` does not perform this check. When a `folderId` is passed via `PUT /api/notes/:id`, line 173 sets `note.folder_id = updates.folderId` without verifying the folder belongs to the authenticated user.

The database FK constraint on `notes.folder_id -> folders.id` will succeed as long as the folder UUID exists in the `folders` table -- FK checks bypass RLS at the PostgreSQL level. The RLS policy on `notes` passes because the note belongs to the requesting user; the RLS policy on `folders` is not consulted because no SELECT is issued against the folders table.

**Impact:** An authenticated user can associate their note with another user's folder by supplying that folder's UUID. The note remains owned by the original user, but the cross-user folder association violates the data isolation model. The practical exploitability is Low (the attacker needs to know or guess a valid folder UUID, and the association does not grant them access to the folder or its other notes), but the principle violation is real.

**Remediation:**
Add the same folder ownership check used in `createNote` to `updateNote`:
```js
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
**Disposition:** FIX NOW -- low effort, completes the ownership enforcement pattern already established in `createNote`.

---

### SEC-014: forgotPassword timing side-channel enables user enumeration
**Severity:** Low
**Category:** Broken Authentication (OWASP A07:2021)
**Affected:** `backend/src/services/authService.js` lines 185-215 (`forgotPassword`)
**Evidence:**
The code comment on line 189 states "Always take the same code path to avoid timing-based user enumeration." However, the implementation returns immediately on line 191 when the email is not registered (`if (!user) { return; }`), while for a registered email it performs: delete existing tokens, insert new token, construct reset URL, and send email via emailService. This produces a measurable timing difference:
- Unregistered email: ~5-20ms (single DB lookup, immediate return)
- Registered email: ~100-500ms+ (DB lookup + DELETE + INSERT + email send)

The HTTP response message is identical in both cases (good), but the response time difference can be measured by an attacker to determine whether an email is registered.

**Impact for this app's threat model:** Low. BrainDump is a note-taking app, not a financial or healthcare system. User enumeration via timing is a known category of vulnerability, but the practical impact here is limited: an attacker learns whether an email address has a BrainDump account, which is of minimal value. The login endpoint already mitigates enumeration by returning the same error for both invalid-email and wrong-password cases.

**Remediation:** Add a minimum response delay to the unregistered path so both paths take approximately the same time. A simple approach is to add `await new Promise(r => setTimeout(r, 200))` before the early return. A more robust approach is to always perform a no-op bcrypt hash or a consistent-time placeholder operation.

**Disposition:** DEFERRED TO CYCLE 3 -- Low severity for this app's threat model. The HTTP response already prevents enumeration via response content; timing-based enumeration requires an attacker with network access and willingness to make statistical measurements.

---

### SEC-015: Rate limiter skip-in-test pattern -- assessed safe for production
**Severity:** Informational
**Category:** Security Misconfiguration (OWASP A05:2021)
**Affected:** `backend/src/middleware/rateLimiter.js` line 79: `skip: () => process.env.NODE_ENV === 'test'`
**Evidence:**
The rate limiter is configured with `skip: () => process.env.NODE_ENV === 'test'`, meaning it is completely bypassed when `NODE_ENV` is `test`. This is acceptable because:
1. `NODE_ENV=test` is only set during automated test runs, never in production or staging.
2. The production Dockerfile and docker-compose files set `NODE_ENV=production`.
3. The `skip` function checks the process environment variable, which cannot be set by an external HTTP request.
4. The rate limiter unit tests construct their own instances to verify limit behaviour independently of this bypass.

**Bypass risk assessment:** None. An attacker cannot set `NODE_ENV` via HTTP headers, query parameters, or request bodies. The environment variable is set at process startup and is immutable during the runtime lifecycle.

**Remediation:** None required.
**Disposition:** ACCEPTED

---

### SEC-016: Password reset token security -- assessed sound
**Severity:** Informational
**Category:** Broken Authentication (OWASP A07:2021)
**Affected:** `backend/src/services/authService.js` lines 194-278
**Evidence:**
Password reset implementation meets all security requirements:
- Token: 32 random bytes (256 bits of entropy), generated via `crypto.randomBytes(32)`
- Storage: SHA-256 hash of token stored in DB, raw token never persisted
- Expiry: 1 hour (`Date.now() + 60 * 60 * 1000`)
- Single-use: token row deleted after successful reset (line 270)
- One-per-user: existing tokens deleted before creating new one (line 199)
- Session invalidation: all sessions for the user are deleted on password reset (line 275-278)

**Remediation:** None required. Implementation is sound.
**Disposition:** ACCEPTED

---

### SEC-017: Account deletion session invalidation -- assessed sound
**Severity:** Informational
**Category:** Session Management (OWASP A07:2021)
**Affected:** `backend/src/routes/auth.js` lines 287-324 (`DELETE /api/auth/account`), `backend/src/services/authService.js` lines 298-319 (`deleteAccount`)
**Evidence:**
Account deletion flow:
1. Requires authentication (`req.session.userId` check, line 289)
2. Requires password confirmation (lines 293-300)
3. Deletes user row via `user.destroy()` (line 318), which triggers CASCADE deletion of all associated data including sessions (per ADR-003)
4. Destroys the current session explicitly (lines 305-313)
5. Clears the session cookie (lines 315-318)

**Race condition assessment:** The user row deletion and session destruction are not wrapped in the same transaction at the application level. However, `user.destroy()` at the DB level CASCADEs to the session table, so any concurrent request using the same session would find the session row deleted by the time it tries to query it. The explicit `req.session.destroy()` after `user.destroy()` is belt-and-suspenders -- the DB CASCADE already handled it. No exploitable race condition exists.

**Remediation:** None required. The CASCADE-first approach is the correct design.
**Disposition:** ACCEPTED

---

### SEC-018: Folder ownership enforcement -- complete on 4 of 5 routes, gap on note-folder assignment
**Severity:** See SEC-013
**Category:** Broken Access Control (OWASP A01:2021)
**Affected:** `backend/src/routes/folders.js` (all routes), `backend/src/routes/notes.js` (folder assignment via PUT)
**Evidence:**
Folder CRUD routes assessment:
1. `GET /api/folders` -- scoped via `Folder.scope({ method: ['forUser', userId] })` -- SAFE
2. `POST /api/folders` -- creates with `user_id: req.session.userId` -- SAFE
3. `GET /api/folders/:id` -- guarded by `ownershipGuard('Folder', 'id')` -- SAFE
4. `PUT /api/folders/:id` -- guarded by `ownershipGuard('Folder', 'id')` -- SAFE
5. `DELETE /api/folders/:id` -- guarded by `ownershipGuard('Folder', 'id')` -- SAFE

Cross-user folder access correctly returns 404 (not 403), preventing resource enumeration.

The gap is in note-folder association via `PUT /api/notes/:id` with `folderId` in the request body -- see SEC-013. The folder CRUD routes themselves are fully protected.

**Remediation:** See SEC-013.
**Disposition:** SEC-013 covers the actionable finding.

---

### SEC-019: Export is client-side only -- no data exfiltration vector
**Severity:** Informational
**Category:** Sensitive Data Exposure (OWASP A02:2021)
**Affected:** `frontend/src/utils/exportNote.js`
**Evidence:**
The export function:
- Creates a `Blob` from the note body already present in client memory
- Uses `URL.createObjectURL()` to create a local object URL
- Triggers download via a hidden `<a download>` element
- Revokes the object URL immediately after click
- No network requests are made (no `fetch`, no `XMLHttpRequest`, no WebSocket)
- No backend export endpoint exists (confirmed via grep of all route files)
- No data is sent to any external service

**Remediation:** None required.
**Disposition:** ACCEPTED

---

### SEC-020: Keyboard shortcuts -- no XSS risk
**Severity:** Informational
**Category:** Cross-Site Scripting (OWASP A03:2021)
**Affected:** `frontend/src/hooks/useKeyboardShortcuts.js`, `frontend/src/components/common/ShortcutReference.jsx`
**Evidence:**
- `useKeyboardShortcuts` registers a single `keydown` listener on `document`. It dispatches to callback functions passed as props -- no dynamic HTML generation, no `innerHTML`, no `eval()`.
- `ShortcutReference` renders a static table of hardcoded shortcut entries using JSX (React's virtual DOM). The `SHORTCUT_ENTRIES` array contains only string literals. No user input is interpolated into the rendered HTML.
- The `isTypingContext` helper reads `e.target.tagName` and `e.target.getAttribute('contenteditable')`, which are DOM properties not influenced by user-supplied data in a way that could cause XSS.

**Remediation:** None required.
**Disposition:** ACCEPTED

---

## Cycle 1 Deferred Findings -- Reassessment

### SEC-001: No rate limiting on authentication endpoints -- RESOLVED
**Original Severity:** High
**Cycle 1 Status:** DEFERRED TO CYCLE 2
**Cycle 2 Status:** RESOLVED by TASK-024

**Verification:**
`express-rate-limit` v7.4.0 is installed and configured in `backend/src/middleware/rateLimiter.js`:
- Window: 15 minutes (`windowMs: 15 * 60 * 1000`)
- Ceiling: 10 requests per window per IP (`max: 10`)
- Applied to: `POST /api/auth/login` and `POST /api/auth/register` (confirmed in `routes/auth.js` lines 37 and 111)
- Key generator: `req.ip` (per-IP limiting)
- `trust proxy` is set to 1 in `app.js` line 57, so `req.ip` reflects the real client IP behind Traefik
- Standard `RateLimit-*` headers are emitted; legacy headers are suppressed
- 429 response with informative error message on limit exceeded

**X-Forwarded-For spoofing risk:** Mitigated. `app.set('trust proxy', 1)` means Express trusts only the first proxy hop (Traefik). An attacker setting `X-Forwarded-For` in their request would have their header overridden by Traefik's forwarding -- Express reads the leftmost untrusted entry, which Traefik sets to the real client IP.

**Verdict:** RESOLVED. Implementation is correct and complete.

---

### SEC-002: No explicit body size limit on express.json() -- OPEN
**Original Severity:** Medium
**Cycle 1 Status:** Open
**Cycle 2 Status:** Still open -- `app.js` line 71 still has `app.use(express.json())` without a `limit` option.

**Assessment:** Express's default limit is 100kb, which is reasonable. However, making it explicit is good practice -- it documents the intent and prevents accidental changes. This is a 1-line fix.

**Verdict:** FIX NOW -- trivial effort: change `express.json()` to `express.json({ limit: '1mb' })`.

---

### SEC-004: Session secret has hardcoded fallback -- OPEN
**Original Severity:** Medium (upgraded to High for this reassessment)
**Cycle 1 Status:** Open
**Cycle 2 Status:** Still open -- `session.js` line 46 still has `secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production'`.

**Assessment:** This is a real risk. If `SESSION_SECRET` is unset in a production deployment, all sessions are signed with a publicly known string. An attacker could forge session cookies. The production Docker setup may set the env var correctly, but the code should fail-safe -- it should refuse to start without the secret in production.

**Verdict:** FIX NOW -- add a guard in `session.js`:
```js
if (isProduction && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required in production');
}
```
This finding is upgraded to **High** because session forgery in production is a Critical-class risk, and the only mitigation is a deployment configuration that could be missed.

---

### SEC-005: clearCookie missing secure flag and path -- OPEN
**Original Severity:** Low
**Cycle 1 Status:** Open
**Cycle 2 Status:** Still open. Both logout (auth.js line 150-153) and account deletion (auth.js line 315-318) call `res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'strict' })` without `secure` or `path`.

**Assessment:** In production (where `cookie.secure: true` is set by session config), the browser may not clear the cookie because the `clearCookie` options do not match the cookie's original attributes. This means logout may not fully clear the session cookie in production. The session is still destroyed server-side, so the stale cookie is harmless (the session store will reject it), but the cookie persists in the browser until expiry.

**Verdict:** FIX NOW -- low effort. Update both `clearCookie` calls to include `secure` and `path`:
```js
res.clearCookie('connect.sid', {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});
```

---

### SEC-006: UUID format validation on route params -- OPEN
**Original Severity:** Low
**Cycle 1 Status:** Open
**Cycle 2 Status:** Still open. `ownershipGuard.js` line 60 passes `resourceId` to `Model.findByPk()` without UUID format validation.

**Assessment:** Impact is limited to unnecessary DB round-trips and potentially noisy error logs (PostgreSQL will return "invalid input syntax for type uuid"). No SQL injection risk (Sequelize parameterises). No data exposure risk.

**Verdict:** DEFERRED TO CYCLE 3 -- Low severity, no data exposure risk.

---

### SEC-007: Error handler leaks internal error messages on 500 -- OPEN
**Original Severity:** Medium
**Cycle 1 Status:** Open
**Cycle 2 Status:** Still open. `app.js` lines 130-142 still return `err.message` in 500 responses.

**Assessment:** When `status === 500`, the response includes the raw error message (line 132: `const message = err.message || 'Internal server error'`). This can expose Sequelize error details, database column names, or other internal information. The `console.error` on line 135 correctly logs the error server-side, but the client should not see it.

**Verdict:** FIX NOW -- low effort. Sanitise 500 responses:
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

## Dependency Audit

### New Dependencies (Cycle 2)

| Package | Version | License | Known CVEs | Maintenance | Transitive Deps | Verdict |
|---|---|---|---|---|---|---|
| express-rate-limit | ^7.4.0 | MIT | None known (npm audit: 0 vulnerabilities) | Active -- latest release 8.3.1 published within past week. Maintainers: nfriedly, gamemaker1. | 1 (ip-address) | APPROVE |

**Notes on express-rate-limit:**
- Widely used (>5 million weekly downloads), well-maintained, active GitHub presence.
- MIT license -- fully compatible with the project.
- The installed version (^7.4.0) will resolve to the latest 7.x. The latest major is 8.x. No urgency to upgrade -- 7.x is still receiving maintenance.
- Single transitive dependency (`ip-address`) is a well-maintained package for IP address parsing.
- In-memory store is acceptable for single-instance deployment (documented in the code). If BrainDump scales to multiple instances, a shared store (Redis, PostgreSQL) will be needed.

### Frontend Dependencies (Cycle 2)

No new frontend dependencies were added in Cycle 2. All frontend dependencies are the same as Cycle 1 and remain APPROVED.

---

## Coverage Summary

| Attack Category | Tested | Findings |
|---|---|---|
| Injection (SQL, tsquery) | Yes | 0 -- search query sanitization is correct. `sanitizeQuery` strips non-alphanumeric characters, filters hyphen-only terms, and uses Sequelize `replacements` (parameterised queries). OBS-V014-01 fix is sound: the second `.filter()` on line 48 correctly rejects terms that contain only hyphens. |
| Broken Authentication | Yes | 1 new (SEC-014: timing side-channel -- Low), 1 resolved (SEC-001: rate limiting) |
| Broken Access Control / IDOR | Yes | 1 new (SEC-013: updateNote folder ownership -- Medium) |
| Security Misconfiguration | Yes | 3 still open from Cycle 1 (SEC-002, SEC-004, SEC-007), 1 new informational (SEC-015) |
| Sensitive Data Exposure | Yes | 0 new -- export is client-side only (SEC-019) |
| Cross-Site Scripting (XSS) | Yes | 0 new -- keyboard shortcuts and ShortcutReference are safe (SEC-020) |
| Components with Known Vulns | Yes | 0 -- no known CVEs in any dependency (npm audit clean) |
| Session Management | Yes | 1 still open from Cycle 1 (SEC-005: clearCookie flags), account deletion session handling is sound (SEC-017) |

---

## Search Fix Verification (OBS-V014-01)

The hyphen-only query bug was fixed by adding a second filter in `sanitizeQuery` (searchService.js line 48):
```js
.filter((term) => /[a-zA-Z0-9]/.test(term));
```

This correctly rejects terms like `-`, `--`, `---` that survive the first filter (they are non-empty after stripping non-alphanumeric-non-hyphen characters) but have no lexeme content for PostgreSQL's `to_tsquery`. After this filter, only terms containing at least one alphanumeric character are passed to the tsquery. If all terms are filtered out, `EMPTY_QUERY` is thrown (line 50-52), which the route handles as a 400 response.

**Verdict:** Fix is correct and complete. No bypass found.

---

## Findings Summary and Disposition

| Finding | Severity | Disposition | Effort |
|---|---|---|---|
| SEC-013 | Medium | FIX NOW | Low -- add folder ownership check to updateNote |
| SEC-014 | Low | DEFERRED TO CYCLE 3 | Medium -- add timing normalization to forgotPassword |
| SEC-015 | Informational | ACCEPTED | N/A |
| SEC-016 | Informational | ACCEPTED | N/A |
| SEC-017 | Informational | ACCEPTED | N/A |
| SEC-018 | See SEC-013 | See SEC-013 | See SEC-013 |
| SEC-019 | Informational | ACCEPTED | N/A |
| SEC-020 | Informational | ACCEPTED | N/A |
| SEC-001 | High (Cycle 1) | RESOLVED | N/A |
| SEC-002 | Medium (Cycle 1) | FIX NOW | Trivial -- 1 line change |
| SEC-004 | High (upgraded) | FIX NOW | Low -- add startup guard |
| SEC-005 | Low (Cycle 1) | FIX NOW | Trivial -- update 2 clearCookie calls |
| SEC-006 | Low (Cycle 1) | DEFERRED TO CYCLE 3 | Low |
| SEC-007 | Medium (Cycle 1) | FIX NOW | Low -- sanitise 500 response |

---

## Recommendation

**RETURN TO BUILDER** -- 1 High and 4 Medium/Low findings require fixes before Demo Sign-off:

### Must Fix (blocks Demo Sign-off)

1. **SEC-004 (High -- upgraded):** Session secret hardcoded fallback. Add production startup guard in `session.js`.

### Should Fix (low effort, complete them now)

2. **SEC-013 (Medium):** Add folder ownership validation to `noteService.updateNote` when `folderId` is provided.
3. **SEC-002 (Medium):** Set explicit body size limit: `express.json({ limit: '1mb' })` in `app.js`.
4. **SEC-007 (Medium):** Sanitise 500 error responses in the error handler in `app.js`.
5. **SEC-005 (Low):** Update both `clearCookie` calls in `auth.js` to include `secure` and `path` flags.

### Deferred to Cycle 3

6. **SEC-006 (Low):** UUID format validation in ownershipGuard.
7. **SEC-014 (Low):** forgotPassword timing side-channel normalization.

### Fix File Map

| File | Findings to Fix |
|---|---|
| `backend/src/config/session.js` | SEC-004 |
| `backend/src/services/noteService.js` | SEC-013 |
| `backend/src/app.js` | SEC-002, SEC-007 |
| `backend/src/routes/auth.js` | SEC-005 |
