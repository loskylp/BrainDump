# Demo Script -- TASK-002
**Task:** TASK-002 -- Database schema, migrations, and RLS role separation
**Date:** 2026-03-19
**Environment:** Local development (Docker Compose)

Prerequisites: Docker is running. The PostgreSQL container is healthy. Migrations have been applied via `docker-entrypoint.sh` or `npm run migrate`.

---

## Scenario 1: All 5 application tables exist after migration

Given   the PostgreSQL database in the running Docker container
When    the table list is queried
Then    all 5 application tables appear

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev -c "\dt"

Expected output includes: `users`, `folders`, `notes`, `note_versions`, `password_reset_tokens`, `SequelizeMeta`.

---

## Scenario 2: UUID primary keys with gen_random_uuid() defaults

Given   the users table exists
When    the schema for the id column is inspected
Then    the data type is uuid and the default is gen_random_uuid()

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev \
      -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'id';"

Expected output: `column_name = id`, `data_type = uuid`, `column_default` contains `gen_random_uuid()`.

---

## Scenario 3: Foreign key constraints with correct ON DELETE behavior

Given   the schema has been migrated
When    the referential constraints are listed
Then    notes.user_id is CASCADE, notes.folder_id is SET NULL, note_versions.note_id is CASCADE

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev -c "
    SELECT kcu.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = rc.constraint_name
    WHERE kcu.table_schema = 'public'
    ORDER BY kcu.table_name, kcu.column_name;"

Expected output (5 rows):

    folders      | user_id    | CASCADE
    note_versions| note_id    | CASCADE
    notes        | folder_id  | SET NULL
    notes        | user_id    | CASCADE
    password_reset_tokens | user_id | CASCADE

---

## Scenario 4: Timestamps are TIMESTAMPTZ with NOW() default

Given   the users table exists
When    the created_at column definition is inspected
Then    the data type is timestamp with time zone and the default is now()

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev \
      -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at';"

Expected output: `data_type = timestamp with time zone`, `column_default` contains `now()`.

---

## Scenario 5: RLS enabled and forced on notes, folders, note_versions

Given   migration 6 has been applied
When    the RLS flags are checked on the three data tables
Then    both rowsecurity and relforcerowsecurity are true for each table

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev -c "
    SELECT pg_tables.tablename, pg_tables.rowsecurity, pg_class.relforcerowsecurity
    FROM pg_tables
    JOIN pg_class ON pg_class.relname = pg_tables.tablename
    WHERE pg_tables.tablename IN ('notes', 'folders', 'note_versions')
    AND schemaname = 'public';"

Expected output: all three rows show `rowsecurity = t` and `relforcerowsecurity = t`.

---

## Scenario 6: RLS policies reference app.current_user_id

Given   RLS is enabled on notes
When    the policy expression is read from pg_policy
Then    the expression uses current_setting('app.current_user_id') to identify the row owner

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev -c "
    SELECT pg_class.relname AS table_name, polname, pg_get_expr(polqual, polrelid) AS using_expr
    FROM pg_policy
    JOIN pg_class ON pg_class.oid = pg_policy.polrelid
    WHERE pg_class.relname IN ('notes', 'folders', 'note_versions')
    ORDER BY pg_class.relname;"

Expected output: each policy's `using_expr` contains `current_setting('app.current_user_id'::text)`.

---

## Scenario 7: rlsContext middleware sets app.current_user_id inside a transaction

Given   the rlsContext middleware is loaded
When    SET LOCAL app.current_user_id is executed inside a PostgreSQL transaction
Then    the variable is visible within the transaction and resets to empty after COMMIT

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev -c "
    BEGIN;
    SET LOCAL app.current_user_id = 'demo-user-uuid-here';
    SELECT current_setting('app.current_user_id', true) AS user_id_in_txn;
    COMMIT;
    SELECT current_setting('app.current_user_id', true) AS user_id_after_commit;"

Expected output:
- First SELECT shows `user_id_in_txn = demo-user-uuid-here`
- Second SELECT shows empty string (variable reset after COMMIT)

---

## Scenario 8: search_vector is populated by trigger on INSERT

Given   a note is inserted into the notes table
When    the insert completes (trigger fires)
Then    the search_vector column contains tsvector lexemes derived from the title and body

Steps (run inside Docker container to set RLS context):

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev -c "
    -- Insert a test user (no RLS on users table)
    INSERT INTO users (id, username, email, password_hash)
    VALUES ('demo0000-0000-0000-0000-000000000001', 'demo', 'demo@example.com', 'hash');

    -- Insert a note with RLS context set
    BEGIN;
    SET LOCAL app.current_user_id = 'demo0000-0000-0000-0000-000000000001';
    INSERT INTO notes (user_id, title, body)
    VALUES ('demo0000-0000-0000-0000-000000000001', 'PostgreSQL Full-Text Search', 'Guide to tsvector')
    RETURNING title, search_vector::text;
    COMMIT;

    -- Clean up
    DELETE FROM users WHERE id = 'demo0000-0000-0000-0000-000000000001';"

Expected output: the `search_vector` column is non-null and contains lexemes such as `'full':3B 'guid':5B 'postgresql':1A 'search':4A 'tsvector':6B 'text':4B`.

---

## Scenario 9: All 6 migration files recorded in SequelizeMeta

Given   sequelize db:migrate has been run
When    SequelizeMeta is queried
Then    all 6 migration filenames are recorded

Steps:

    docker exec braindump-postgres-1 psql -U braindump_dev -d braindump_dev \
      -c "SELECT name FROM \"SequelizeMeta\" ORDER BY name;"

Expected output (6 rows, one per migration file): names including `create-users`, `create-folders`, `create-notes`, `create-note-versions`, `create-password-reset-tokens`, `enable-rls`.
