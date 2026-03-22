# Security Report -- Cycle 3

**Date:** 2026-03-21
**Sentinel:** Claude Opus 4.6
**Profile:** Commercial
**Scope:** TASK-027 (Tagging backend), TASK-028 (Tagging frontend), TASK-029 (Bulk ZIP export), TASK-030 (Reading mode)

---

## Overall Verdict: PASS

No Critical or High severity findings. Two Medium and two Low findings documented below with remediation guidance.

---

## Finding Summary

| # | Severity | Category | Finding | Status |
|---|----------|----------|---------|--------|
| F-01 | Medium | Missing Rate Limiting | Tag creation and note-tag association endpoints lack rate limiting | Open |
| F-02 | Medium | Content-Disposition Header Injection | Username in export ZIP filename is not sanitized for HTTP header context | Open |
| F-03 | Low | Informational Disclosure | Export endpoint exposes username in Content-Disposition header | Open |
| F-04 | Low | Missing UUID Validation | `?tags=` query parameter values are not validated as UUIDs before being passed to Sequelize | Open |
| F-05 | Informational | Dependency Audit | `archiver@7.0.1` -- APPROVE | N/A |
| F-06 | Informational | Dependency Audit | `adm-zip@0.5.16` (devDependency) -- APPROVE | N/A |

---

## Detailed Findings

### F-01: Tag creation and note-tag association endpoints lack rate limiting

**Severity:** Medium
**Category:** Denial of Service / Resource Exhaustion
**OWASP:** API4:2023 -- Unrestricted Resource Consumption

**Description:**
The following endpoints create database rows but are not protected by any rate limiter:
- `POST /api/tags` (creates a tag row)
- `POST /api/notes/:id/tags` (creates a tag row via inline creation and/or a note_tags junction row)
- `DELETE /api/tags/:id` and `DELETE /api/notes/:id/tags/:tagId` (less critical but still unthrottled)

Rate limiting currently exists only on the auth routes (`POST /api/auth/login`, `POST /api/auth/register`) via the `authRateLimiter` middleware. The tag endpoints are authenticated, which limits the blast radius to legitimate users, but a compromised or malicious session could flood the tags and note_tags tables.

The `Tag.findOrCreate` deduplication in `createTag` provides some protection against duplicate tag names per user, but does not limit the total number of distinct tags a user can create.

**Evidence:**
- `backend/src/routes/tags.js` lines 17-19: only `authenticate` and `rlsContext` middleware applied; no rate limiter.
- `backend/src/routes/notes.js` lines 293-304: `POST /:id/tags` has no rate limiter.
- `backend/src/middleware/rateLimiter.js`: only exports `authRateLimiter`, not used on tag routes.

**Remediation:**
Add a general API rate limiter (e.g., 100 requests per 15-minute window per user session) to the tag router, or apply the existing `express-rate-limit` factory to create a `tagRateLimiter` and attach it to `POST /api/tags` and `POST /api/notes/:id/tags`. Consider also adding a per-user tag count ceiling (e.g., 500 tags maximum) enforced in `tagService.createTag`.

---

### F-02: Username in export ZIP filename not sanitized for HTTP header context

**Severity:** Medium
**Category:** Header Injection
**OWASP:** A03:2021 -- Injection

**Description:**
The bulk export endpoint at `GET /api/notes/export` (lines 131-136 of `notes.js`) constructs the `Content-Disposition` header filename using the username fetched from the database:

```
const zipFilename = `braindump-export-${username}-${date}.zip`;
res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
```

If a username contains double quotes, backslashes, or newline characters, this could result in a malformed or injectable HTTP header. While the registration endpoint likely constrains usernames, the defense should not rely on an upstream validation contract that is not explicitly verified at the point of use.

**Evidence:**
- `backend/src/routes/notes.js` lines 131-136: direct string interpolation into `Content-Disposition` header without sanitization.
- `noteService.getUserById` (line 247) fetches the username without transformation.

**Remediation:**
Sanitize the username before interpolation into the header: strip or replace characters that are invalid in HTTP header field values (double quotes, backslashes, newlines, carriage returns). Alternatively, use `encodeURIComponent(username)` and the `filename*=UTF-8''...` Content-Disposition syntax per RFC 5987.

---

### F-03: Export endpoint exposes username in Content-Disposition header

**Severity:** Low
**Category:** Information Disclosure

**Description:**
The ZIP filename includes the authenticated user's username (`braindump-export-{username}-{date}.zip`). In a shared environment or if the download link is intercepted, this reveals the username. This is a design choice documented in the TASK-029 spec, so this finding is informational rather than actionable.

**Evidence:**
- `backend/src/routes/notes.js` line 133.

**Remediation:**
No action required if this is an accepted design decision. If privacy is a concern, replace the username with a generic identifier (e.g., `braindump-export-{date}.zip`).

---

### F-04: `?tags=` query parameter values not validated as UUIDs

**Severity:** Low
**Category:** Input Validation
**OWASP:** A03:2021 -- Injection

**Description:**
The `GET /api/notes` endpoint splits `req.query.tags` by comma and passes the resulting strings directly to `tagService.getNotesWithTags`, which uses them in a Sequelize `Op.in` clause:

```javascript
// notes.js line 45
const tagIds = req.query.tags ? req.query.tags.split(',').filter(Boolean) : null;

// tagService.js line 229
const noteTagRows = await NoteTag.findAll({
  where: { tag_id: { [Op.in]: tagIds } },
  ...
});
```

Sequelize parameterizes the `Op.in` values, so SQL injection is not possible. However, passing non-UUID strings (e.g., arbitrary text) will cause a PostgreSQL type-cast error (`invalid input syntax for type uuid`) that bubbles as a 500 Internal Server Error rather than a clean 400 validation error. This is a quality issue rather than a security vulnerability, but it exposes internal error details if error handling is not configured to suppress them.

**Evidence:**
- `backend/src/routes/notes.js` line 45: no UUID format validation.
- `backend/src/services/tagService.js` line 229: values used in `Op.in` without type checking.

**Remediation:**
Add a UUID format check (e.g., regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) to each tag ID before passing to the service. Return 400 for invalid values.

---

## Security Review by Focus Area

### 1. Tag Input Sanitization (AC-2) -- PASS

**Tag name validation** is thorough. `tagService.validateTagName` (lines 25-57) enforces:
- Non-empty, trimmed
- Maximum 50 characters
- No whitespace
- Regex `^[\p{L}\d-]+$/u` -- only Unicode letters, digits, and hyphens

This regex blocks `<`, `>`, `"`, `'`, `/`, `\`, and all other XSS-relevant characters. An XSS payload like `<script>alert(1)</script>` would be rejected at the validation layer before reaching the database.

**Frontend rendering** is safe. `TagChip.jsx` (line 29) renders `{tag.name}` as a React text node, not via `dangerouslySetInnerHTML`. React automatically escapes text content, so even if a malicious tag name bypassed backend validation, it would render as literal text, not executable HTML.

`TagFilter.jsx` (line 63) similarly renders `{tag.name}` as button text content -- safe.

`TagInput.jsx` does not use `dangerouslySetInnerHTML` anywhere.

**Verdict:** Tag names cannot contain XSS payloads due to backend validation. Frontend rendering is safe by default (React text interpolation). No finding.

### 2. Bulk Export Authorization (AC-3) -- PASS

The export endpoint at `GET /api/notes/export` (line 122-165 of `notes.js`) is protected by:
- `authenticate` middleware (line 26) -- rejects unauthenticated requests
- `rlsContext` middleware (line 27) -- sets PostgreSQL RLS context

The `getAllNotesWithFolders(userId)` call (line 128) uses `Note.scope({ method: ['forUser', userId] })` which scopes the query to `WHERE user_id = userId`. A user cannot export another user's notes.

**Verdict:** Per-user isolation is enforced at both application and database layers. No finding.

### 3. Reading Mode Unauthenticated Access (AC-4) -- PASS

`ReadingView` is rendered inside `WorkspacePage` (line 1151-1157 of `WorkspacePage.jsx`). `WorkspacePage` is wrapped in `ProtectedRoute` in `App.jsx` (lines 64-66). An unauthenticated user cannot reach `WorkspacePage` or `ReadingView` -- they are redirected to `/login`.

`ReadingView` uses `dangerouslySetInnerHTML` (line 188), but the markdown-it instance is configured with `html: false` (line 56), which escapes raw HTML tags in user content. This is the same configuration used by the existing `Preview.jsx` component. The XSS risk from `dangerouslySetInnerHTML` is mitigated by the markdown renderer's HTML escaping.

**Verdict:** Reading mode is protected by authentication. Markdown rendering is safe. No finding.

### 4. Dependency Audit (AC-5)

#### archiver@7.0.1 -- APPROVE

| Criterion | Assessment |
|---|---|
| **Maintenance** | Active. Last release 7.0.1 on 2024-01-29. GitHub repo (archiverjs/node-archiver) has regular commits. Multiple maintainers. |
| **Known CVEs** | No known CVEs against archiver@7.x as of 2026-03-21. The npm advisory database does not list any vulnerabilities for this version. |
| **License** | MIT -- compatible with the project. |
| **Transitive risk** | Dependencies: archiver-utils, async, buffer-crc32, readable-stream, readdir-glob, tar-stream, zip-stream. All well-established packages with MIT/ISC licenses. No deep transitive chains of concern. |

**Recommendation:** APPROVE. No conditions.

#### adm-zip@0.5.16 (devDependency) -- APPROVE

| Criterion | Assessment |
|---|---|
| **Maintenance** | Active. Regular releases. |
| **Known CVEs** | Historical path traversal vulnerability (CVE-2018-1002204) was in versions < 0.4.11. Version 0.5.16 is not affected. |
| **License** | MIT -- compatible. |
| **Transitive risk** | Zero dependencies. |

**Recommendation:** APPROVE. devDependency only -- not shipped to production. No conditions.

### 5. Tag Name Search Vector Injection -- PASS

Migration 003 (`20260321000003-update-search-vector-with-tags.js`) introduces two PostgreSQL trigger functions that include tag names in the search vector.

The `notes_search_vector_update()` function (lines 17-32) retrieves tag names via a `SELECT string_agg(t.name, ' ')` JOIN query and passes the result through `to_tsvector('english', COALESCE(tag_text, ''))`. The tag names flow through `to_tsvector()`, which is a PostgreSQL built-in that parses text into lexemes -- it does not execute SQL. There is no string concatenation into executable SQL within the trigger.

The `refresh_note_search_vector()` function (lines 37-74) follows the same pattern: `string_agg` retrieval into a variable, then `to_tsvector` processing.

Tag names are stored via Sequelize's parameterized `findOrCreate` (tagService.js line 85-88), so they cannot inject SQL at write time either.

**Verdict:** No SQL injection vector. Tag names are parameterized at insertion and processed through safe PostgreSQL built-in functions in triggers. No finding.

### 6. Rate Limiting on Tag Endpoints -- FINDING (F-01)

See F-01 above. Tag creation endpoints are not rate-limited. Medium severity.

### 7. `?tags=` Query Parameter Injection -- PASS (with Low finding)

The `Op.in` clause in Sequelize generates parameterized SQL (`WHERE tag_id IN ($1, $2, ...)`). SQL injection is not possible regardless of the input values. However, non-UUID values cause unhandled PostgreSQL type errors (see F-04).

**Verdict:** No injection vulnerability. Input validation gap documented as F-04 (Low).

---

## Notes

- All backend routes under review (`/api/tags/*`, `/api/notes/export`, `/api/notes/:id/tags/*`) require authentication via the `authenticate` middleware applied at the router level.
- User isolation is consistently enforced via `forUser` Sequelize scopes across all service methods reviewed.
- The `ownershipGuard` middleware is correctly applied to single-resource note routes (`GET /:id`, `PUT /:id`, `DELETE /:id`) but not to the tag sub-routes (`POST /:id/tags`, `DELETE /:id/tags/:tagId`). This is acceptable because `tagService.addTagToNote` and `removeTagFromNote` independently verify both note and tag ownership via `forUser` scopes.
- No new frontend routes were added in Cycle 3. `ReadingView` is a component rendered within the already-protected `WorkspacePage`.
