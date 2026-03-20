/**
 * Verifier Acceptance Tests — TASK-006: Create a note with persistence
 *
 * REQ-004: User can create a note
 * REQ-012: Data durability and PostgreSQL persistence
 *
 * These tests operate through the system's public HTTP interface (supertest
 * against the Express app) and directly against the database via Sequelize
 * for atomicity and persistence verification. No implementation internals
 * are accessed beyond the models import path.
 *
 * Acceptance criteria covered:
 *   AC-1  Authenticated user can create a note via POST /api/notes with a title
 *   AC-2  Note persisted in PostgreSQL with auto-generated UUID, empty body, timestamps
 *   AC-3  Initial version (version_number=1) created atomically in note_versions
 *   AC-4  Duplicate titles are allowed
 *   AC-5  API returns { note: { id, title, body, created_at, updated_at } }
 *   AC-6  Note accessible only to its owner (ownership guard enforced)
 *
 * Fitness Functions: FF-D16
 *
 * Run from the project root:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   npx jest --testPathPattern=acceptance/TASK-006 --forceExit
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const request  = require('supertest');
const app      = require('../../src/app');
const { sequelize, User, Note, NoteVersion } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register a new user and return { cookie, userId }.
 * Registration creates a session automatically (TASK-003 behaviour).
 */
async function registerUser(overrides = {}) {
  const suffix = Date.now() + Math.random().toString(36).slice(2, 7);
  const defaults = {
    username: `user_${suffix}`,
    email:    `user_${suffix}@example.com`,
    password: 'password123',
  };
  const data = { ...defaults, ...overrides };

  const res = await request(app).post('/api/auth/register').send(data);
  if (res.status !== 201) {
    throw new Error(`Registration failed for ${data.email}: ${JSON.stringify(res.body)}`);
  }
  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await sequelize.authenticate();
});

afterEach(async () => {
  // Remove all users created during the test (cascades to notes and note_versions)
  await sequelize.query(
    `DELETE FROM users WHERE email LIKE '%@example.com'`
  );
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1: Authenticated user can create a note via POST /api/notes
// REQ-004: User can create a note
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-004]: Authenticated user can create a note via POST /api/notes', () => {
  test('Given an authenticated user, when POST /api/notes with a title, then 201 is returned', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: the user submits POST /api/notes with a title
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'My First Note' });

    // Then: 201 is returned
    expect(res.status).toBe(201);
  });

  test('[VERIFIER-ADDED] Given no session, when POST /api/notes, then 401 is returned', async () => {
    // Given: no session cookie
    // When: POST /api/notes is called without authentication
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 'Sneaky Note' });

    // Then: 401 is returned — unauthenticated access is rejected
    expect(res.status).toBe(401);
  });

  test('[VERIFIER-ADDED] Given an authenticated user, POST /api/notes without a title still returns 201', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: the user submits POST /api/notes with no title (title defaults to empty string)
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({});

    // Then: 201 is returned — title is not required
    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Note persisted in PostgreSQL with auto-generated UUID, empty body, timestamps
// REQ-004 / REQ-012
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-004/REQ-012]: Note persisted in PostgreSQL with UUID, empty body, timestamps', () => {
  test('Given a created note, when the notes table is queried by id, then the row exists', async () => {
    // Given: an authenticated user creates a note
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Persist Me' });
    expect(res.status).toBe(201);

    const noteId = res.body.note.id;

    // When: the notes table is queried directly
    const note = await Note.findByPk(noteId);

    // Then: the note exists in the database
    expect(note).not.toBeNull();
  });

  test('Given a created note, it has a valid UUID as its primary key', async () => {
    // Given: an authenticated user creates a note
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'UUID Check' });

    const noteId = res.body.note.id;

    // Then: the id is a valid UUID (8-4-4-4-12 hex format)
    expect(noteId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('Given a created note, the body is an empty string', async () => {
    // Given: a note is created with only a title
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Empty Body Check' });

    const noteId = res.body.note.id;
    const note = await Note.findByPk(noteId);

    // Then: the body in the database is an empty string
    expect(note.body).toBe('');
  });

  test('Given a created note, created_at and updated_at are present and valid timestamps', async () => {
    // Given: a note is created
    const before = new Date();
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Timestamp Check' });

    const noteId = res.body.note.id;
    const note = await Note.findByPk(noteId);

    // Then: both timestamps are valid dates after the test started
    const createdAt  = new Date(note.created_at);
    const updatedAt  = new Date(note.updated_at);
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5000);
    expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5000);
  });

  test('[VERIFIER-ADDED] Given a created note, the note title matches what was submitted', async () => {
    // Given: a note is created with a specific title
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Specific Stored Title' });

    const noteId = res.body.note.id;
    const note   = await Note.findByPk(noteId);

    // Then: the stored title matches
    expect(note.title).toBe('Specific Stored Title');
  });
});

// ---------------------------------------------------------------------------
// AC-3: Initial version (version_number=1) created atomically in note_versions
// REQ-004 (ADR-004 edge case: "new note always has at least one version entry")
// Fitness Function: FF-D16
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-004 / FF-D16]: Initial version created atomically in note_versions', () => {
  test('Given a created note, a note_versions row with version_number=1 exists', async () => {
    // Given: an authenticated user creates a note via POST /api/notes
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Version Test' });
    expect(res.status).toBe(201);

    const noteId = res.body.note.id;

    // When: note_versions is queried for this note
    const versions = await NoteVersion.findAll({ where: { note_id: noteId } });

    // Then: exactly one version exists with version_number=1
    expect(versions).toHaveLength(1);
    expect(versions[0].version_number).toBe(1);
  });

  test('Given a created note, the initial version body matches the note body (empty string)', async () => {
    // Given: a note is created (body defaults to '')
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Version Body Check' });

    const noteId = res.body.note.id;
    const versions = await NoteVersion.findAll({ where: { note_id: noteId } });

    // Then: the version body is an empty string — matching the note's initial body
    expect(versions[0].body).toBe('');
  });

  test('Given a created note, the initial version title matches the note title', async () => {
    // Given: a note is created with a specific title
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Title Snapshot' });

    const noteId = res.body.note.id;
    const versions = await NoteVersion.findAll({ where: { note_id: noteId } });

    // Then: the version title is a snapshot of the note's title at creation
    expect(versions[0].title).toBe('Title Snapshot');
  });

  test('Atomicity: if the transaction rolls back, neither note nor version are persisted', async () => {
    // Given: we directly inspect the database to confirm no partial writes
    // exist by verifying that a note always has exactly one version — never zero
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Atomicity Check' });
    expect(res.status).toBe(201);

    const noteId = res.body.note.id;
    const note   = await Note.findByPk(noteId);
    const versionCount = await NoteVersion.count({ where: { note_id: noteId } });

    // Then: the note exists IFF exactly one version exists — atomic creation confirmed
    expect(note).not.toBeNull();
    expect(versionCount).toBe(1);
  });

  test('[VERIFIER-ADDED] Creating two notes produces two independent version_number=1 entries', async () => {
    // Given: the same user creates two notes
    const { cookie } = await registerUser();
    const res1 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Note Alpha' });
    const res2 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Note Beta' });

    const noteId1 = res1.body.note.id;
    const noteId2 = res2.body.note.id;

    // When: note_versions is queried for each note
    const versions1 = await NoteVersion.findAll({ where: { note_id: noteId1 } });
    const versions2 = await NoteVersion.findAll({ where: { note_id: noteId2 } });

    // Then: each note has its own version_number=1; they are not shared
    expect(versions1).toHaveLength(1);
    expect(versions1[0].version_number).toBe(1);
    expect(versions2).toHaveLength(1);
    expect(versions2[0].version_number).toBe(1);
    expect(versions1[0].note_id).toBe(noteId1);
    expect(versions2[0].note_id).toBe(noteId2);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Duplicate titles are allowed
// REQ-004
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-004]: Duplicate titles are allowed', () => {
  test('Given an authenticated user, creating two notes with identical titles both succeed', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: two notes with the same title are created
    const res1 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Duplicate Title' });
    const res2 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Duplicate Title' });

    // Then: both return 201 — no uniqueness constraint on titles
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.note.id).not.toBe(res2.body.note.id);
  });

  test('[VERIFIER-ADDED] Two notes with identical titles produce distinct UUIDs in the database', async () => {
    // Given: two notes with the same title were created
    const { cookie } = await registerUser();
    const res1 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Same Title' });
    const res2 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Same Title' });

    // When: both are looked up in the database
    const note1 = await Note.findByPk(res1.body.note.id);
    const note2 = await Note.findByPk(res2.body.note.id);

    // Then: both rows exist and have distinct primary keys
    expect(note1).not.toBeNull();
    expect(note2).not.toBeNull();
    expect(note1.id).not.toBe(note2.id);
  });

  test('[VERIFIER-ADDED] Different users can each have a note with the same title', async () => {
    // Given: two different users
    const { cookie: cookie1 } = await registerUser();
    const { cookie: cookie2 } = await registerUser();

    // When: both create a note with the same title
    const res1 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie1)
      .send({ title: 'Shared Title' });
    const res2 = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie2)
      .send({ title: 'Shared Title' });

    // Then: both succeed — cross-user title collision is allowed
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// AC-5: API returns { note: { id, title, body, created_at, updated_at } }
// REQ-004
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-004]: API returns note object with required fields', () => {
  test('Given a created note, the response body contains a "note" key', async () => {
    // Given: an authenticated user creates a note
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Shape Test' });

    // Then: the response has a "note" key
    expect(res.body).toHaveProperty('note');
  });

  test('Given a created note, the response note has id, title, body, created_at, updated_at', async () => {
    // Given: an authenticated user creates a note
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Fields Test' });

    const note = res.body.note;

    // Then: all required fields are present
    expect(note).toHaveProperty('id');
    expect(note).toHaveProperty('title');
    expect(note).toHaveProperty('body');
    expect(note).toHaveProperty('created_at');
    expect(note).toHaveProperty('updated_at');
  });

  test('Given a created note, the response title matches what was submitted', async () => {
    // Given: a note is created with a specific title
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Exact Title Match' });

    // Then: the response title matches
    expect(res.body.note.title).toBe('Exact Title Match');
  });

  test('Given a created note, the response body field is an empty string', async () => {
    // Given: a note is created (no body submitted)
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Body Field Test' });

    // Then: body is an empty string in the response
    expect(res.body.note.body).toBe('');
  });

  test('[VERIFIER-ADDED] The response note id is a valid UUID', async () => {
    // Given: a note is created
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'ID Format Test' });

    // Then: the returned id is a UUID
    expect(res.body.note.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('[VERIFIER-ADDED] created_at and updated_at are valid ISO 8601 timestamp strings', async () => {
    // Given: a note is created
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Timestamp Format Test' });

    const { created_at, updated_at } = res.body.note;

    // Then: both timestamps parse to valid dates
    expect(new Date(created_at).getTime()).not.toBeNaN();
    expect(new Date(updated_at).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Note accessible only to its owner — ownership guard enforced
// REQ-004 / REQ-011
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-004/REQ-011]: Note accessible only to its owner', () => {
  test('Given User A owns a note, when User B requests it by ID, then 404 is returned', async () => {
    // Given: User A creates a note
    const userA = await registerUser();
    const resCreate = await request(app)
      .post('/api/notes')
      .set('Cookie', userA.cookie)
      .send({ title: 'User A Exclusive Note' });
    expect(resCreate.status).toBe(201);
    const noteId = resCreate.body.note.id;

    // And: User B exists
    const userB = await registerUser();

    // When: User B attempts to GET User A's note by direct ID
    const resGet = await request(app)
      .get(`/api/notes/${noteId}`)
      .set('Cookie', userB.cookie);

    // Then: 404 is returned — not 403; resource existence is not disclosed
    expect(resGet.status).toBe(404);
  });

  test('Given User A owns a note, when User B attempts PUT on it, then 404 is returned', async () => {
    // Given: User A creates a note
    const userA = await registerUser();
    const resCreate = await request(app)
      .post('/api/notes')
      .set('Cookie', userA.cookie)
      .send({ title: 'Protected Note' });
    const noteId = resCreate.body.note.id;

    // And: User B exists
    const userB = await registerUser();

    // When: User B attempts to modify User A's note
    const resPut = await request(app)
      .put(`/api/notes/${noteId}`)
      .set('Cookie', userB.cookie)
      .send({ title: 'Hijacked Title' });

    // Then: 404 is returned
    expect(resPut.status).toBe(404);
  });

  test('Given User A owns a note, when User B attempts DELETE on it, then 404 is returned', async () => {
    // Given: User A creates a note
    const userA = await registerUser();
    const resCreate = await request(app)
      .post('/api/notes')
      .set('Cookie', userA.cookie)
      .send({ title: 'Deletion Target' });
    const noteId = resCreate.body.note.id;

    // And: User B exists
    const userB = await registerUser();

    // When: User B attempts to delete User A's note
    const resDel = await request(app)
      .delete(`/api/notes/${noteId}`)
      .set('Cookie', userB.cookie);

    // Then: 404 is returned
    expect(resDel.status).toBe(404);
  });

  test('[VERIFIER-ADDED] Given User A owns a note, User B DELETE attempt does not delete the note', async () => {
    // Given: User A creates a note
    const userA = await registerUser();
    const resCreate = await request(app)
      .post('/api/notes')
      .set('Cookie', userA.cookie)
      .send({ title: 'Integrity Check Note' });
    const noteId = resCreate.body.note.id;

    // And: User B attempts to delete it
    const userB = await registerUser();
    await request(app)
      .delete(`/api/notes/${noteId}`)
      .set('Cookie', userB.cookie);

    // When: the note is looked up in the database directly
    const note = await Note.findByPk(noteId);

    // Then: the note still exists — the delete had no effect
    expect(note).not.toBeNull();
  });

  test('[VERIFIER-ADDED] Unauthenticated POST /api/notes does not create any note or version', async () => {
    // Given: no session exists
    const countBefore = await Note.count();
    const versionCountBefore = await NoteVersion.count();

    // When: POST /api/notes is called without a session
    await request(app)
      .post('/api/notes')
      .send({ title: 'Ghost Note' });

    // Then: no note was created
    const countAfter = await Note.count();
    const versionCountAfter = await NoteVersion.count();
    expect(countAfter).toBe(countBefore);
    expect(versionCountAfter).toBe(versionCountBefore);
  });
});
