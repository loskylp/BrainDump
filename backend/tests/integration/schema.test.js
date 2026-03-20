/**
 * Schema integration tests for TASK-002.
 *
 * Validates all acceptance criteria by introspecting the live database after
 * migrations have been applied. Tests run against the local PostgreSQL instance.
 *
 * Acceptance criteria covered:
 *   AC-1:  All 5 tables exist
 *   AC-2:  UUID primary keys via gen_random_uuid()
 *   AC-3:  FK constraints with correct ON DELETE behavior
 *   AC-4:  TIMESTAMPTZ columns defaulting to NOW()
 *   AC-5:  RLS enabled and forced on notes, folders, note_versions
 *   AC-6:  Migration role / RLS bypass (OBS-002) -- tested by migration success
 *   AC-7:  SET LOCAL app.current_user_id middleware (tested in rlsContext.test.js)
 *   AC-8:  search_vector TSVECTOR column with GIN index
 *   AC-9:  Trigger function fires on INSERT/UPDATE of title/body
 *   AC-10: Schema introspection confirms FK constraints
 */

'use strict';

require('dotenv').config();

const { sequelize, User, Note, NoteVersion, Folder } = require('../../src/models');

beforeAll(async () => {
  // Ensure database is connected
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

describe('AC-1: All 5 tables exist after migration', () => {
  const expectedTables = ['users', 'folders', 'notes', 'note_versions', 'password_reset_tokens'];

  test.each(expectedTables)('table "%s" exists', async (tableName) => {
    const [results] = await sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = :tableName
      ) AS "exists"`,
      { replacements: { tableName } }
    );
    expect(results[0].exists).toBe(true);
  });
});

describe('AC-2: UUID primary keys via gen_random_uuid()', () => {
  const tables = ['users', 'folders', 'notes', 'note_versions', 'password_reset_tokens'];

  test.each(tables)('table "%s" has UUID primary key with gen_random_uuid() default', async (tableName) => {
    const [results] = await sequelize.query(
      `SELECT c.column_name, c.data_type, c.column_default
       FROM information_schema.columns c
       JOIN information_schema.table_constraints tc
         ON tc.table_name = c.table_name AND tc.constraint_type = 'PRIMARY KEY'
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.column_name = c.column_name
       WHERE c.table_name = :tableName AND c.table_schema = 'public'`,
      { replacements: { tableName } }
    );
    expect(results.length).toBe(1);
    expect(results[0].column_name).toBe('id');
    expect(results[0].data_type).toBe('uuid');
    expect(results[0].column_default).toContain('gen_random_uuid()');
  });
});

describe('AC-3: Foreign key constraints with correct ON DELETE behavior', () => {
  test('notes.user_id -> users.id ON DELETE CASCADE', async () => {
    const [results] = await sequelize.query(`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      WHERE kcu.table_name = 'notes'
        AND kcu.column_name = 'user_id'
        AND kcu.table_schema = 'public'
    `);
    expect(results.length).toBe(1);
    expect(results[0].delete_rule).toBe('CASCADE');
  });

  test('notes.folder_id -> folders.id ON DELETE SET NULL', async () => {
    const [results] = await sequelize.query(`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      WHERE kcu.table_name = 'notes'
        AND kcu.column_name = 'folder_id'
        AND kcu.table_schema = 'public'
    `);
    expect(results.length).toBe(1);
    expect(results[0].delete_rule).toBe('SET NULL');
  });

  test('folders.user_id -> users.id ON DELETE CASCADE', async () => {
    const [results] = await sequelize.query(`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      WHERE kcu.table_name = 'folders'
        AND kcu.column_name = 'user_id'
        AND kcu.table_schema = 'public'
    `);
    expect(results.length).toBe(1);
    expect(results[0].delete_rule).toBe('CASCADE');
  });

  test('note_versions.note_id -> notes.id ON DELETE CASCADE', async () => {
    const [results] = await sequelize.query(`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      WHERE kcu.table_name = 'note_versions'
        AND kcu.column_name = 'note_id'
        AND kcu.table_schema = 'public'
    `);
    expect(results.length).toBe(1);
    expect(results[0].delete_rule).toBe('CASCADE');
  });

  test('password_reset_tokens.user_id -> users.id ON DELETE CASCADE', async () => {
    const [results] = await sequelize.query(`
      SELECT rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = rc.constraint_name
      WHERE kcu.table_name = 'password_reset_tokens'
        AND kcu.column_name = 'user_id'
        AND kcu.table_schema = 'public'
    `);
    expect(results.length).toBe(1);
    expect(results[0].delete_rule).toBe('CASCADE');
  });
});

describe('AC-4: TIMESTAMPTZ columns defaulting to NOW()', () => {
  const tablesWithTimestamps = [
    { table: 'users', columns: ['created_at', 'updated_at'] },
    { table: 'folders', columns: ['created_at', 'updated_at'] },
    { table: 'notes', columns: ['created_at', 'updated_at'] },
    { table: 'note_versions', columns: ['created_at'] },
    { table: 'password_reset_tokens', columns: ['created_at'] },
  ];

  test.each(tablesWithTimestamps)('table "$table" has TIMESTAMPTZ columns with NOW() default', async ({ table, columns }) => {
    for (const col of columns) {
      const [results] = await sequelize.query(
        `SELECT data_type, column_default
         FROM information_schema.columns
         WHERE table_name = :table AND column_name = :col AND table_schema = 'public'`,
        { replacements: { table, col } }
      );
      expect(results.length).toBe(1);
      expect(results[0].data_type).toBe('timestamp with time zone');
      expect(results[0].column_default).toMatch(/now\(\)/i);
    }
  });
});

describe('AC-5: RLS enabled and forced on notes, folders, note_versions', () => {
  const rlsTables = ['notes', 'folders', 'note_versions'];

  test.each(rlsTables)('RLS is enabled on "%s"', async (tableName) => {
    const [results] = await sequelize.query(
      `SELECT rowsecurity FROM pg_tables
       WHERE tablename = :tableName AND schemaname = 'public'`,
      { replacements: { tableName } }
    );
    expect(results.length).toBe(1);
    expect(results[0].rowsecurity).toBe(true);
  });

  test.each(rlsTables)('RLS is forced on "%s"', async (tableName) => {
    const [results] = await sequelize.query(
      `SELECT relforcerowsecurity FROM pg_class
       WHERE relname = :tableName`,
      { replacements: { tableName } }
    );
    expect(results.length).toBe(1);
    expect(results[0].relforcerowsecurity).toBe(true);
  });

  test.each(rlsTables)('RLS policy exists on "%s"', async (tableName) => {
    const [results] = await sequelize.query(
      `SELECT polname FROM pg_policy
       JOIN pg_class ON pg_class.oid = pg_policy.polrelid
       WHERE pg_class.relname = :tableName`,
      { replacements: { tableName } }
    );
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe('AC-8: search_vector TSVECTOR column with GIN index', () => {
  test('notes table has search_vector column of type tsvector', async () => {
    const [results] = await sequelize.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'notes' AND column_name = 'search_vector' AND table_schema = 'public'`
    );
    expect(results.length).toBe(1);
    expect(results[0].data_type).toBe('tsvector');
  });

  test('GIN index exists on notes.search_vector', async () => {
    const [results] = await sequelize.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename = 'notes' AND indexname = 'idx_notes_search'`
    );
    expect(results.length).toBe(1);
    expect(results[0].indexdef).toContain('gin');
  });
});

describe('AC-9: Trigger function fires on INSERT/UPDATE of title or body', () => {
  test('notes_search_vector_update trigger function exists', async () => {
    const [results] = await sequelize.query(
      `SELECT routine_name FROM information_schema.routines
       WHERE routine_name = 'notes_search_vector_update' AND routine_schema = 'public'`
    );
    expect(results.length).toBe(1);
  });

  test('notes_search_vector_trigger is attached to notes table', async () => {
    const [results] = await sequelize.query(
      `SELECT trigger_name, event_manipulation, action_timing
       FROM information_schema.triggers
       WHERE trigger_name = 'notes_search_vector_trigger'
         AND event_object_table = 'notes'`
    );
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Trigger fires on INSERT and UPDATE
    const events = results.map((r) => r.event_manipulation);
    expect(events).toContain('INSERT');
    expect(events).toContain('UPDATE');
    // Trigger fires BEFORE
    expect(results[0].action_timing).toBe('BEFORE');
  });

  test('search_vector is populated on INSERT', async () => {
    // Need to set RLS context before inserting
    await sequelize.query("SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000001'");

    // Create a test user first
    const [userResults] = await sequelize.query(
      `INSERT INTO users (id, username, email, password_hash)
       VALUES ('a0000000-0000-0000-0000-000000000001', 'testuser', 'trigger-test@example.com', '$2a$12$fakehash')
       RETURNING id`
    );

    await sequelize.query("SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000001'");

    // Insert a note
    const [noteResults] = await sequelize.query(
      `INSERT INTO notes (user_id, title, body)
       VALUES ('a0000000-0000-0000-0000-000000000001', 'PostgreSQL Indexing', 'Guide to GIN indexes')
       RETURNING id, search_vector`
    );

    expect(noteResults[0].search_vector).toBeTruthy();

    // Clean up
    await sequelize.query("DELETE FROM users WHERE id = 'a0000000-0000-0000-0000-000000000001'");
  });

  test('search_vector updates on UPDATE of title', async () => {
    await sequelize.query("SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000002'");

    await sequelize.query(
      `INSERT INTO users (id, username, email, password_hash)
       VALUES ('a0000000-0000-0000-0000-000000000002', 'testuser2', 'trigger-test2@example.com', '$2a$12$fakehash')`
    );

    await sequelize.query("SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000002'");

    const [insertResult] = await sequelize.query(
      `INSERT INTO notes (id, user_id, title, body)
       VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Original Title', 'body')
       RETURNING search_vector::text AS sv`
    );

    await sequelize.query("SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000002'");

    await sequelize.query(
      `UPDATE notes SET title = 'Updated Title' WHERE id = 'b0000000-0000-0000-0000-000000000001'`
    );

    await sequelize.query("SET LOCAL app.current_user_id = 'a0000000-0000-0000-0000-000000000002'");

    const [updateResult] = await sequelize.query(
      `SELECT search_vector::text AS sv FROM notes WHERE id = 'b0000000-0000-0000-0000-000000000001'`
    );

    // search_vector should now contain 'updat' (stemmed form of 'Updated')
    expect(updateResult[0].sv).toContain('updat');

    // Clean up
    await sequelize.query("DELETE FROM users WHERE id = 'a0000000-0000-0000-0000-000000000002'");
  });
});

describe('AC-10: Schema introspection confirms expected FK constraints', () => {
  test('all expected foreign key constraints exist', async () => {
    const [results] = await sequelize.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    // Expected FK relationships
    const fkMap = results.map((r) => ({
      table: r.table_name,
      column: r.column_name,
      ref_table: r.referenced_table,
      ref_column: r.referenced_column,
      delete_rule: r.delete_rule,
    }));

    // notes.user_id -> users.id CASCADE
    expect(fkMap).toContainEqual({
      table: 'notes', column: 'user_id', ref_table: 'users', ref_column: 'id', delete_rule: 'CASCADE',
    });

    // notes.folder_id -> folders.id SET NULL
    expect(fkMap).toContainEqual({
      table: 'notes', column: 'folder_id', ref_table: 'folders', ref_column: 'id', delete_rule: 'SET NULL',
    });

    // folders.user_id -> users.id CASCADE
    expect(fkMap).toContainEqual({
      table: 'folders', column: 'user_id', ref_table: 'users', ref_column: 'id', delete_rule: 'CASCADE',
    });

    // note_versions.note_id -> notes.id CASCADE
    expect(fkMap).toContainEqual({
      table: 'note_versions', column: 'note_id', ref_table: 'notes', ref_column: 'id', delete_rule: 'CASCADE',
    });

    // password_reset_tokens.user_id -> users.id CASCADE
    expect(fkMap).toContainEqual({
      table: 'password_reset_tokens', column: 'user_id', ref_table: 'users', ref_column: 'id', delete_rule: 'CASCADE',
    });

    // Should be exactly 5 FK constraints total
    expect(fkMap.length).toBe(5);
  });
});

describe('AC-6: Migration role can operate (OBS-002)', () => {
  test('migrations completed successfully (verified by table existence)', async () => {
    // This test validates OBS-002: the migration role was able to create all
    // tables and then apply RLS in a separate migration step. The fact that
    // we reach this point means the migration role was not blocked by RLS.
    const [results] = await sequelize.query(
      `SELECT COUNT(*) AS count FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('users', 'folders', 'notes', 'note_versions', 'password_reset_tokens')`
    );
    expect(parseInt(results[0].count)).toBe(5);
  });
});

describe('Sequelize models are correctly configured', () => {
  test('User model excludes password_hash from toJSON', () => {
    const user = User.build({
      username: 'test',
      email: 'test@example.com',
      password_hash: '$2a$12$secrethash',
    });
    const json = user.toJSON();
    expect(json).not.toHaveProperty('password_hash');
    expect(json).toHaveProperty('username', 'test');
    expect(json).toHaveProperty('email', 'test@example.com');
  });

  test('Note model has forUser scope', () => {
    expect(typeof Note.scope).toBe('function');
    // Should not throw when creating a scoped query builder
    const scoped = Note.scope({ method: ['forUser', 'some-uuid'] });
    expect(scoped).toBeDefined();
  });

  test('Folder model has forUser scope', () => {
    const scoped = Folder.scope({ method: ['forUser', 'some-uuid'] });
    expect(scoped).toBeDefined();
  });

  test('NoteVersion model has updatedAt disabled', () => {
    const options = NoteVersion.options;
    expect(options.updatedAt).toBe(false);
  });
});
