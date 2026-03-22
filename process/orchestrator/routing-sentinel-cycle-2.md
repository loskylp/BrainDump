# Routing Instruction
**To:** Sentinel
**Phase:** Cycle 2 Execution -- Cycle-Level Security Review
**Task:** Perform a comprehensive security review of all Cycle 2 changes (10 tasks). Assess new attack surface, review Cycle 1 deferred findings, audit new dependencies.
**Load these artifacts:**
- `process/sentinel/security-reports/cycle-1-security.md` (Cycle 1 findings -- baseline; SEC-001 through SEC-012)
- `process/analyst/requirements-v3.md` (requirements including REQ-018 and REQ-019)
- `process/architect/architecture-overview-v1.md` (architecture context)
- `process/architect/fitness-functions.md` (fitness functions index)
- `process/planner/task-plan-v2.md` (Cycle 2 task plan)
- All source code in `backend/src/` and `frontend/src/`
- `backend/package.json` and `frontend/package.json` (dependency manifests)
- `.env` (check for secrets management posture -- do not log contents)
- `docker-compose.staging.yml` and any DevOps configuration files
**Produce:** `process/sentinel/security-reports/cycle-2-security.md`
**Iteration:** N/A (single-pass security review)
**Verifier mode:** N/A (Sentinel, not Verifier)
**Return to:** Orchestrator when complete

---

## Review Scope

This is the cycle-level security review for Cycle 2. All 10 tasks are VERIFIED PASS. The Sentinel must review the cumulative security posture before Demo Sign-off can proceed.

### Cycle 2 Tasks to Review

| Task | Feature | Security Focus |
|---|---|---|
| TASK-024 | Rate limiting on auth endpoints | Verify `express-rate-limit` implementation is correct and complete. This resolves SEC-001 from Cycle 1. Confirm: per-IP limiting on `/api/auth/login` and `/api/auth/register`, 10 req/15min, 429 response with appropriate headers. Check that rate limiter cannot be trivially bypassed (e.g., X-Forwarded-For spoofing). |
| TASK-014 | Full-text search | Input sanitization for PostgreSQL `tsquery`. OBS-V014-01 (tsquery injection) was reported and fixed -- verify the fix is sound. Check that search queries cannot escape the tsquery parser or cause SQL injection. |
| TASK-015 | Password reset flow | Token security: SHA-256 hash stored (not plaintext), 1-hour expiry, single-use (token deleted after use). Timing-safe response for unregistered emails (OBS-V015-01 was flagged). Email content: reset link does not leak sensitive data. |
| TASK-017 | Folder organization | Ownership enforcement on all folder CRUD routes. Cross-user folder access must return 404 (not 403). Folder-note association must verify ownership of both folder and note. |
| TASK-018 | Responsive design | No direct security implications. Verify no new endpoints or data exposure introduced. |
| TASK-019 | Account deletion | Cascade verification: user deletion must remove all associated data (notes, folders, versions, sessions, password reset tokens). Session invalidation: active sessions must be destroyed on account deletion. Confirm no orphaned data remains. |
| TASK-020 | Fitness function instrumentation | No direct security implications. Verify fitness function endpoints (if any) are not publicly accessible without authentication. |
| TASK-021 | DevOps Phase 2 | OBS-V021-03 Node.js 20 deprecation (fix before June 2026). Secrets management: `.env` usage in staging/production, no secrets in docker-compose files or CI config. CORS configuration in staging environment. |
| TASK-025 | Keyboard shortcuts | No security implications. Client-side only. |
| TASK-026 | Export notes as Markdown | Client-side only export. Verify no server-side export endpoint was created. Confirm no data exfiltration vector (e.g., export does not send data to external services). |

### Cycle 1 Deferred Findings -- Reassessment Required

The following findings were identified in Cycle 1 and deferred. The Sentinel must reassess each one and decide: **FIX NOW** (blocks Demo Sign-off), **DEFER TO CYCLE 3**, or **ACCEPT AS-IS** (risk accepted).

| Finding | Severity | Description | Cycle 1 Status |
|---|---|---|---|
| SEC-001 | High | No rate limiting on auth endpoints | RESOLVED by TASK-024 -- verify implementation |
| SEC-002 | Medium | No explicit body size limit on `express.json()` | Open -- check if addressed in Cycle 2 |
| SEC-004 | Medium | SESSION_SECRET hardcoded fallback in code | Open -- check if addressed in Cycle 2 |
| SEC-005 | Low | `clearCookie` missing `secure` flag and `path` | Open -- check if addressed in Cycle 2 |
| SEC-006 | Low | UUID format validation on route params | Open -- check if addressed in Cycle 2 |
| SEC-007 | Medium | Error handler leaks internal error messages on 500 | Open -- check if addressed in Cycle 2 |

### New Dependencies to Audit

Review any new packages added to `backend/package.json` and `frontend/package.json` since Cycle 1. Known additions include:
- `express-rate-limit` (backend, for TASK-024)
- Any packages added for search, password reset, export, or keyboard shortcuts

For each new dependency: check license compatibility, known CVEs, maintenance status.

### Attack Categories to Cover

Follow the same OWASP-aligned attack category matrix used in the Cycle 1 report:
- Injection (SQL, tsquery, NoSQL)
- Broken Authentication (rate limiting effectiveness, password reset token security)
- Broken Access Control / IDOR (folder ownership, cross-user data access)
- Security Misconfiguration (Express config, CORS, error handling, session management)
- Sensitive Data Exposure (secrets management, error messages, export data)
- Cross-Site Scripting (XSS) (any new rendering paths)
- Components with Known Vulnerabilities (new dependencies)
- Session Management (account deletion session cleanup, cookie flags)

### Output Format

Produce the Security Report at `process/sentinel/security-reports/cycle-2-security.md` with:
1. Each finding numbered SEC-NNN (continue from SEC-012)
2. Severity: Critical / High / Medium / Low / Informational
3. OWASP category
4. Affected code location
5. Evidence
6. Remediation recommendation
7. For Cycle 1 deferred findings: explicit RESOLVED / DEFER / ACCEPT verdict with rationale
8. Dependency audit table (new dependencies only; reference Cycle 1 audit for unchanged ones)
9. Coverage summary table
10. Final recommendation: PASS (no blocking findings) or RETURN TO BUILDER (with specific fix list)

### Blocking Criteria

- Any Critical or High finding blocks Demo Sign-off
- Medium findings: Sentinel decides whether they block or are deferred
- Low and Informational: tracked, do not block
