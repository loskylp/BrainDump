# ADR-006: Per-user Data Isolation
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

REQ-011 requires strict per-user data isolation: a user can only access their own notes, note versions, and folders. No user can access another user's data through any interface -- direct URL, API call, or search. The Brief's domain invariants state that cross-user visibility does not exist. Security and data durability are first-class concerns for this project.

**Driver:** Security, Auth/Identity
**Door type:** One-way -- data isolation is enforced at every data access point; removing or changing the enforcement mechanism requires touching every query and route

## Trade-off Analysis

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Application-level only (middleware injects user_id into queries) | Simple, testable, full control in application code | Single layer of defense -- a missed query filter leaks data | A forgotten WHERE clause exposes another user's data | LOW to add RLS later as an additional layer |
| Database-level only (Row-Level Security policies) | Defense at the database layer -- cannot be bypassed by application bugs | Requires setting session variables on each connection, more complex connection management, harder to test in isolation | RLS misconfiguration silently hides data or silently exposes it | HIGH -- removing RLS and replacing with app-level requires query rewrites |
| Both: application-level + RLS (defense in depth) | Two independent enforcement layers -- app bug cannot leak data because RLS blocks it; RLS misconfiguration is caught by app-level tests | More complex setup, must manage PostgreSQL session variables, two places to maintain | Negligible -- both layers independently prevent leaks | MEDIUM -- removing either layer is straightforward |

**Recommendation:** Both: application-level + RLS (defense in depth)
**Because:** Data isolation is a security-critical concern. A single missed `WHERE user_id = ?` in a query would expose another user's notes. RLS provides a safety net: even if the application has a bug, the database itself rejects cross-user access. The added complexity is justified because the consequence of failure (data leak between users) is severe for a service where users trust BrainDump with their knowledge.

## Decision

### Layer 1: Application-level Enforcement

**Ownership guard middleware** (`ownershipGuard.js`):
- Applied to all routes under `/api/notes`, `/api/folders`, `/api/versions`
- For routes with a resource ID parameter (`:id`, `:noteId`), the middleware loads the resource and verifies `resource.user_id === req.session.userId`
- If the resource does not exist or belongs to another user, the middleware returns 404 (not 403 -- to prevent resource enumeration)
- For list/search routes, the middleware ensures the query includes `WHERE user_id = req.session.userId`

**Sequelize default scope:**
- Each model (Note, Folder, NoteVersion) defines a default scope that adds `WHERE user_id = :currentUserId` to all queries
- The current user ID is set from `req.session.userId` at the start of each request
- This provides a second application-level safety net: even if a route handler forgets to filter by user, the model's default scope adds the filter

### Layer 2: Row-Level Security (RLS)

**RLS policies on notes, folders, and note_versions tables:**

```sql
-- Enable RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

-- Force RLS on table owner too (prevents superuser bypass in testing)
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
ALTER TABLE folders FORCE ROW LEVEL SECURITY;
ALTER TABLE note_versions FORCE ROW LEVEL SECURITY;

-- Policy: users can only access their own data
CREATE POLICY user_isolation_notes ON notes
    USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_isolation_folders ON folders
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- note_versions: access controlled via the parent note's user_id
CREATE POLICY user_isolation_versions ON note_versions
    USING (note_id IN (SELECT id FROM notes WHERE user_id = current_setting('app.current_user_id')::uuid));
```

**Session variable management:**
- At the start of each request, the Express middleware executes `SET LOCAL app.current_user_id = '<user_id>'` on the database connection
- `SET LOCAL` scopes the variable to the current transaction, preventing leakage between requests on pooled connections
- For unauthenticated requests (public pages), the variable is set to a null UUID that matches no rows

### Interaction Between Layers

The two layers are independent:
- If the application middleware correctly filters by user_id, RLS is redundant (but harmless)
- If the application middleware has a bug and omits the user_id filter, RLS blocks the query from returning other users' data
- Both layers are tested independently in the test suite

### Response Behavior

When a user attempts to access a resource they do not own:
- The API returns **404 Not Found** (not 403 Forbidden)
- This prevents resource enumeration: the attacker cannot distinguish "this resource exists but belongs to someone else" from "this resource does not exist"

## Fitness Functions

**Dev:**
- Test: User A cannot access User B's note by direct ID (returns 404)
- Test: User A cannot access User B's folder by direct ID (returns 404)
- Test: User A cannot access User B's note version by direct ID (returns 404)
- Test: User A's search results never include User B's notes
- Test: List endpoints return only the authenticated user's resources
- Test: RLS policy violation is logged when application-level filter is deliberately bypassed in test (validates RLS is active)

**Prod:**
- Monitor for RLS policy violations in PostgreSQL logs -- any violation indicates an application bug that bypassed the middleware. Warning: 1 violation | Critical: any violation (investigate immediately)
- Monitor 404 response rate on resource endpoints -- spike may indicate enumeration attempt

## Consequences

- Every database connection must set `app.current_user_id` before executing queries -- this adds one `SET LOCAL` statement per request (negligible overhead)
- RLS on `note_versions` uses a subquery against `notes` -- this is slightly more expensive than a direct column check, but the note_versions table is only queried in the context of a specific note (not scanned broadly)
- Returning 404 instead of 403 means the API cannot distinguish "not found" from "forbidden" for the client -- this is intentional for security, but the Builder should be aware that debugging access issues requires checking server logs, not relying on response codes
- The superuser/migration user must bypass RLS for administrative operations (migrations, backups) -- this is handled by using a separate database role without RLS policies applied, or by using `ALTER TABLE ... FORCE ROW LEVEL SECURITY` only on the application role
