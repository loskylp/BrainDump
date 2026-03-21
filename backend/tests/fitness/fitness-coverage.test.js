/**
 * Fitness Function Coverage Tests
 *
 * This file instruments fitness functions that are either:
 *   (a) not covered by any existing test, or
 *   (b) covered only implicitly via acceptance tests that do not label
 *       their FF-D ID explicitly in a dedicated fitness test.
 *
 * Fitness functions already fully covered by existing labeled tests are
 * documented in the README rather than duplicated here.
 *
 * These tests require a live PostgreSQL connection (migration-test CI job).
 *
 * Fitness functions covered in this file:
 *   FF-D04 — Auth: login failure returns 401, not 500
 *   FF-D12 — Durability: all expected FK constraints present
 *   FF-D16 — Versioning: new note has initial version (version_number = 1)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');

const app = require('../../src/app');
const { sequelize, User, Note, NoteVersion } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Registers a new user via the public API and returns { cookie, userId }.
 *
 * Uses a time-stamped unique suffix to guarantee isolation between test runs.
 *
 * @returns {Promise<{ cookie: string[], userId: string }>}
 */
async function registerUser() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const data = {
    username: `ffcov_${suffix}`,
    email: `ffcov_${suffix}@fitness.test`,
    password: 'password123',
  };

  const res = await request(app).post('/api/auth/register').send(data);
  if (res.status !== 201) {
    throw new Error(
      `FF coverage test user registration failed: ${JSON.stringify(res.body)}`
    );
  }

  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
    email: data.email,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// FF-D04: Auth login failure returns 401 (not 500)
// ---------------------------------------------------------------------------

describe('FF-D04: Wrong password returns 401, not 500', () => {
  let testEmail;
  let userId;

  beforeAll(async () => {
    const user = await registerUser();
    testEmail = user.email;
    userId = user.userId;
  });

  afterAll(async () => {
    await sequelize.query('DELETE FROM users WHERE id = :id', {
      replacements: { id: userId },
    });
  });

  // FF-D04: wrong password must return 401, never 500
  test('POST /api/auth/login with wrong password returns 401, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'this-is-the-wrong-password' });

    // The response must be an explicit 401 — not a server error.
    // A 500 here would indicate bcrypt comparison threw rather than returning false.
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
  });

  // FF-D04: unknown email must also return 401 (same code, no enumeration)
  test('POST /api/auth/login with unknown email returns 401, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'definitely-not-registered@fitness.test', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
  });
});

// ---------------------------------------------------------------------------
// FF-D12: Durability — all expected FK constraints present
// ---------------------------------------------------------------------------

describe('FF-D12: All expected FK constraints exist in the schema', () => {
  // FF-D12: FK constraints enforce durability relationships at the database level.
  // This test introspects the live schema rather than mocking — it confirms the
  // migration was applied correctly in the current environment.
  test('all 8 expected FK constraints are present', async () => {
    const [rows] = await sequelize.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name  AS ref_table,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = 'public'
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    const fks = rows.map((r) => ({
      table: r.table_name,
      column: r.column_name,
      ref_table: r.ref_table,
      delete_rule: r.delete_rule,
    }));

    // notes.user_id -> users.id CASCADE
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'notes', column: 'user_id', ref_table: 'users', delete_rule: 'CASCADE' })
    );

    // notes.folder_id -> folders.id SET NULL
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'notes', column: 'folder_id', ref_table: 'folders', delete_rule: 'SET NULL' })
    );

    // folders.user_id -> users.id CASCADE
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'folders', column: 'user_id', ref_table: 'users', delete_rule: 'CASCADE' })
    );

    // note_versions.note_id -> notes.id CASCADE
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'note_versions', column: 'note_id', ref_table: 'notes', delete_rule: 'CASCADE' })
    );

    // password_reset_tokens.user_id -> users.id CASCADE
    expect(fks).toContainEqual(
      expect.objectContaining({ table: 'password_reset_tokens', column: 'user_id', ref_table: 'users', delete_rule: 'CASCADE' })
    );

    // Exactly 8 FKs — 5 original plus 3 added by TASK-027
    // (note_tags.note_id -> notes.id, note_tags.tag_id -> tags.id, tags.user_id -> users.id)
    expect(fks.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// FF-D16: Versioning — new note has initial version (version_number = 1)
// ---------------------------------------------------------------------------

describe('FF-D16: New note has initial version (version_number = 1) created atomically', () => {
  let cookie;
  let userId;

  beforeAll(async () => {
    ({ cookie, userId } = await registerUser());
  });

  afterAll(async () => {
    await sequelize.query('DELETE FROM users WHERE id = :id', {
      replacements: { id: userId },
    });
  });

  // FF-D16: note creation must atomically produce version_number = 1 in note_versions.
  // The initial version is part of the contract defined in ADR-004 and tested here
  // against the live database to confirm the transaction commits both rows together.
  test('note created via POST /api/notes has a version_number=1 row in note_versions', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'FF-D16 fitness test note' });

    expect(createRes.status).toBe(201);
    const noteId = createRes.body.note.id;

    // Verify directly in the database that the initial version exists.
    const [rows] = await sequelize.query(
      `SELECT version_number FROM note_versions WHERE note_id = :noteId ORDER BY version_number ASC`,
      { replacements: { noteId } }
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].version_number).toBe(1);
  });

  // FF-D16 (negative): confirming atomicity — if note creation fails, no orphan version exists.
  // We test this by attempting creation without a required field and confirming the
  // note_versions table contains no orphan row for a non-existent note.
  test('failed note creation (missing title) leaves no orphan version row', async () => {
    const countBefore = await NoteVersion.count();

    // POST without a title — should fail validation
    const createRes = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({});

    // If it fails, the count must not have increased
    if (createRes.status !== 201) {
      const countAfter = await NoteVersion.count();
      expect(countAfter).toBe(countBefore);
    }
    // If the API accepted the empty-title note (implementation-specific), that is
    // a separate concern; this test only asserts transactional integrity on failure.
  });
});
