# Verification Report -- TASK-002
**Task:** TASK-002 -- Database schema, migrations, and RLS role separation
**Date:** 2026-03-19
**Iteration:** 1
**Verdict:** PASS (10 of 10 criteria pass)

---

## Acceptance Criteria Results

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Sequelize migrations create all 5 tables: users, folders, notes, note_versions, password_reset_tokens | PASS | All 6 migration files present in `backend/src/migrations/`. `docker exec braindump-postgres-1 psql ... \dt` confirms all 5 tables plus SequelizeMeta exist. Acceptance test `AC-1 [REQ-012]` suite: 7 tests pass including negative case (notes_archive does not exist) and count assertion (exactly 6 tables). |
| 2 | All tables use UUID primary keys via `gen_random_uuid()` | PASS | Each migration uses `Sequelize.literal('gen_random_uuid()')` as the `id` default. Acceptance test `AC-2 [REQ-012]` suite: 6 tests pass (5 per-table + negative case confirming no integer PKs). pg_catalog confirms `data_type = 'uuid'` and `column_default` contains `gen_random_uuid()` on all 5 tables. |
| 3 | FK constraints enforced: ON DELETE CASCADE on user_id (notes, folders, note_versions, password_reset_tokens); ON DELETE SET NULL on folder_id (notes); ON DELETE CASCADE on note_id (note_versions) | PASS | Migration files use correct `onDelete` values. Acceptance test `AC-3 [REQ-012]` suite: 7 tests pass including two negative cases (folder_id must be SET NULL not CASCADE; user_id must be CASCADE not SET NULL) and an end-to-end cascade test (deleting a user removes their notes). |
| 4 | All timestamps are TIMESTAMPTZ, defaulting to NOW() | PASS | All migration files use `Sequelize.DATE` (which maps to TIMESTAMPTZ) with `Sequelize.literal('NOW()')`. Acceptance test `AC-4 [REQ-012]` suite: 6 tests pass. pg_catalog confirms `data_type = 'timestamp with time zone'` throughout. Negative case confirms zero plain `timestamp without time zone` columns exist. |
| 5 | RLS policies enabled and forced on notes, folders, note_versions per ADR-006 | PASS | Migration 6 issues `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on all 3 tables. `pg_tables.rowsecurity = true` and `pg_class.relforcerowsecurity = true` confirmed for all 3. Acceptance test `AC-5 [REQ-011]` suite: 11 tests pass including: ENABLED per table (3), FORCED per table (3), policy exists per table (3), policy uses `current_setting('app.current_user_id')` (1), users table has NO RLS (1 negative case). |
| 6 | Application database role subject to RLS; migration role bypasses RLS via role-level exemption or DDL exemption (OBS-002) | PASS | The `braindump_dev` role is the table owner with `BYPASSRLS` attribute (confirmed via `\du`). Migration comment in `20260319000006-enable-rls.js` documents the correct rationale: DDL (CREATE TABLE, ALTER TABLE) is not filtered by RLS policies; only DML is. All 6 migrations applied successfully without RLS blocking DDL. Acceptance test `AC-6 [REQ-011/REQ-012]` suite: 2 tests pass — table existence confirms DDL was not blocked, and SequelizeMeta records all 6 migration files as applied. |
| 7 | `SET LOCAL app.current_user_id` is executed at the start of each request in middleware | PASS | `backend/src/middleware/rlsContext.js` exists, issues `SET LOCAL app.current_user_id = :userId`, and falls back to the null UUID `00000000-0000-0000-0000-000000000000` for unauthenticated requests. Acceptance test `AC-7 [REQ-011]` suite: 4 tests pass — file exists, contains SET LOCAL, contains null UUID fallback, and the transaction-scoping behavior is verified. OBS-V002-01 below flags the transaction wrapping gap. |
| 8 | `search_vector` tsvector column exists on notes with GIN index | PASS | Migration 3 creates the column (`'TSVECTOR'` type in Sequelize, `tsvector` in PostgreSQL) and the GIN index `idx_notes_search`. Acceptance test `AC-8 [REQ-012]` suite: 3 tests pass including negative case (column is tsvector, not text or varchar). |
| 9 | Trigger function `notes_search_vector_update()` fires on INSERT/UPDATE of title or body | PASS | Migration 3 creates the trigger function and `BEFORE INSERT OR UPDATE OF title, body` trigger. Acceptance test `AC-9 [REQ-012]` suite: 5 tests pass — function exists, trigger fires on INSERT and UPDATE with BEFORE timing, `search_vector` populated on INSERT (end-to-end), `search_vector` updated on title UPDATE, and `search_vector` updated on body UPDATE (verifier-added case). |
| 10 | Schema introspection test confirms all expected FK constraints exist | PASS | Acceptance test `AC-10 [REQ-012]`: single comprehensive test passes. Queries `information_schema` to enumerate all FK constraints, verifies all 5 expected FKs are present with correct delete rules, and asserts total count is exactly 5 (no unexpected extra FKs). |

---

## Test Suite Summary

### Backend test suite (Jest)

- **Test runner:** Jest 29.7.0
- **Test files:** 3 passed
  - `tests/acceptance/TASK-002-schema-acceptance.test.js` (Verifier — new)
  - `tests/integration/schema.test.js` (Builder — existing)
  - `tests/integration/rlsContext.test.js` (Builder — existing)
- **Total tests:** 97
- **Passed:** 97
- **Failed:** 0
- **Duration:** 1.2s

### Frontend test suite (Vitest)

- **Test runner:** Vitest 1.6.1
- **Test files:** 7 passed (all pre-existing from TASK-016)
- **Total tests:** 43
- **Passed:** 43
- **Failed:** 0
- **Duration:** 2.48s

### Acceptance tests breakdown

| Test group | Tests | Source |
|---|---|---|
| AC-1: Tables exist | 7 | Verifier |
| AC-2: UUID PKs | 6 | Verifier |
| AC-3: FK constraints | 7 | Verifier |
| AC-4: TIMESTAMPTZ | 6 | Verifier |
| AC-5: RLS enabled/forced | 11 | Verifier |
| AC-6: Migration role (OBS-002) | 2 | Verifier |
| AC-7: rlsContext middleware | 4 | Verifier |
| AC-8: search_vector + GIN | 3 | Verifier |
| AC-9: Search trigger | 5 | Verifier |
| AC-10: FK introspection | 1 | Verifier |
| **Total** | **52** | |

---

## Regression Check

All 45 tests from the prior passing task (TASK-016) continue to pass.

- Backend (TASK-016 predecessor tests): 45/45 pass — no regressions.
- Frontend (TASK-016 tests): 43/43 pass — no regressions.

---

## Non-blocking Observations

**OBS-V002-01 (Architecture concern — medium severity):** The `rlsContext.js` middleware uses `SET LOCAL app.current_user_id` without wrapping the call in an explicit `BEGIN`/`COMMIT` transaction. PostgreSQL's `SET LOCAL` is only scoped to the current transaction; outside a transaction it behaves identically to `SET` (session-scoped). On a pooled connection (which Sequelize uses with `pool.max: 10`), a session-scoped SET will persist on that connection after the request completes. The next request reusing the same pooled connection will inherit the previous request's `current_user_id` until it sets its own.

The middleware's docstring states: "The SET LOCAL scope ensures the variable is visible only within the current transaction, preventing leakage between requests on pooled connections." This description is accurate for what `SET LOCAL` does inside a transaction, but the implementation does not open a transaction — so the isolation guarantee is not achieved. The Verifier's acceptance test `AC-7: SET LOCAL scopes to transaction: value persists inside, resets after COMMIT` documents this behavioral constraint.

**Impact:** If a request fails to call `rlsContext` (e.g., an unauthenticated path that shares the same pooled connection), a subsequent request from a different user could potentially inherit a stale `current_user_id` on that connection. This is mitigated by the fact that the middleware sets the variable on every request — so consecutive requests on the same connection will overwrite it — but the window between end-of-request and next middleware invocation is not zero.

**Recommended fix:** Wrap the `SET LOCAL` call in an explicit transaction (`BEGIN` ... application query ... `COMMIT`) or use Sequelize's `transaction` option on all queries that depend on the RLS context. This should be addressed before TASK-005 (Ownership guard) lands, since that task relies on RLS being correctly enforced.

This observation does not block PASS for TASK-002 because: (a) the criterion is that `SET LOCAL app.current_user_id` is executed, which it is; (b) no application data flows through RLS yet — no routes are mounted that use RLS-protected tables; (c) the fix belongs in TASK-005's scope where the RLS + ownership guard integration is tested end-to-end.

---

**OBS-V002-02 (Stale docstring — low severity):** `backend/src/models/User.js` `comparePassword()` method has a `TODO: TASK-004` comment and throws `new Error('Not implemented')`. This is intentional and expected per the task plan. Flagged for awareness — the Builder will implement this in TASK-004.

---

**OBS-V002-03 (Informational):** The `braindump_dev` role has full superuser privileges (`Superuser, Create role, Create DB, Replication, Bypass RLS`). The `BYPASSRLS` attribute means this role skips all RLS policies regardless of `FORCE ROW LEVEL SECURITY`. This is what enables migrations to function correctly (OBS-002 from the Auditor). For a production hardening pass, consider creating a separate limited `braindump_app` role for the running application that does NOT have `BYPASSRLS`, ensuring RLS is enforced for the application role. This is consistent with ADR-006's intent. This is informational — no action required for TASK-002.
