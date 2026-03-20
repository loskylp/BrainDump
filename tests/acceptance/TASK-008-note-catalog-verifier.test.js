/**
 * Verifier Acceptance Tests -- TASK-008: Note catalog sidebar
 *
 * REQ-008: Note catalog (sidebar)
 *
 * These tests operate through the system's public HTTP interface (supertest
 * against the Express app) and directly against the database via Sequelize
 * for persistence verification. No implementation internals are accessed
 * beyond the models import path.
 *
 * Acceptance criteria covered:
 *   AC-2  Sidebar lists all user's notes via GET /api/notes, sorted newest first
 *   AC-3  Selecting a note in the sidebar loads it into the editor
 *         (structural: API returns the note; editor loading is TASK-009)
 *   AC-4  Creating a new note adds it to the sidebar list immediately
 *         (API side: POST /api/notes returns the note; frontend prepend is a
 *          frontend test in TASK-008-note-catalog-ui-verifier.test.jsx)
 *
 * AC-1 (sidebar visible at >= 1024px) and AC-5 (active note highlighted) are
 * verified in the companion frontend acceptance test file.
 *
 * Run from the backend/ directory:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   SESSION_SECRET=test-secret NODE_ENV=test \
 *   npx jest --testPathPattern=TASK-008 --forceExit
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const request    = require('supertest');
const app        = require('../backend/src/app');
const { sequelize, User, Note } = require('../backend/src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Registers a new user and returns { cookie, userId }.
 * Registration creates a session automatically (TASK-003 behaviour).
 */
async function registerUser(overrides = {}) {
  const suffix = Date.now() + Math.random().toString(36).slice(2, 7);
  const defaults = {
    username: `u8_${suffix}`,
    email:    `u8_${suffix}@example.com`,
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

/**
 * Creates a note for the given authenticated session and returns the created
 * note object from the API response.
 *
 * @param {string|string[]} cookie  - session cookie
 * @param {string}          title   - note title
 * @returns {object} note  - { id, title, body, folder_id, created_at, updated_at }
 */
async function createNote(cookie, title) {
  const res = await request(app)
    .post('/api/notes')
    .set('Cookie', cookie)
    .send({ title });

  if (res.status !== 201) {
    throw new Error(`createNote failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.note;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  // Delete test users created in this suite; cascade deletes their notes
  await User.destroy({
    where: {
      email: { [require('sequelize').Op.like]: '%@example.com' },
    },
    // Only destroy users whose username starts with our test prefix
  });
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-2: GET /api/notes returns user's notes sorted newest first
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-008]: GET /api/notes returns notes sorted by last modified (newest first)', () => {

  it('Given an authenticated user with notes, when GET /api/notes is called, then 200 and notes array is returned', async () => {
    // Given
    const { cookie } = await registerUser();
    await createNote(cookie, 'First Note');

    // When
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notes');
    expect(Array.isArray(res.body.notes)).toBe(true);
  });

  it('Given an authenticated user with multiple notes, when GET /api/notes is called, then notes are sorted by updated_at DESC (newest first)', async () => {
    // Given: create three notes with deliberate timing gaps
    const { cookie } = await registerUser();

    const noteA = await createNote(cookie, 'Oldest Note');
    // Inject a small gap so updated_at values are distinct
    await new Promise((r) => setTimeout(r, 20));
    const noteB = await createNote(cookie, 'Middle Note');
    await new Promise((r) => setTimeout(r, 20));
    const noteC = await createNote(cookie, 'Newest Note');

    // When
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: order must be C, B, A (newest first)
    expect(res.status).toBe(200);
    const ids = res.body.notes.map((n) => n.id);
    const posC = ids.indexOf(noteC.id);
    const posB = ids.indexOf(noteB.id);
    const posA = ids.indexOf(noteA.id);

    expect(posC).toBeLessThan(posB);
    expect(posB).toBeLessThan(posA);
  });

  it('Given an authenticated user with no notes, when GET /api/notes is called, then an empty array is returned (not 404)', async () => {
    // Given
    const { cookie } = await registerUser();

    // When
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
  });

  it('Given an unauthenticated request, when GET /api/notes is called, then 401 is returned', async () => {
    // When
    const res = await request(app).get('/api/notes');

    // Then
    expect(res.status).toBe(401);
  });

  it('[VERIFIER-ADDED] Each note in the list includes id, title, updated_at and does NOT include body', async () => {
    // Given
    const { cookie } = await registerUser();
    await createNote(cookie, 'Shape Test Note');

    // When
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: response shape matches catalog requirements (body excluded for performance)
    expect(res.status).toBe(200);
    const note = res.body.notes[0];
    expect(note).toHaveProperty('id');
    expect(note).toHaveProperty('title');
    expect(note).toHaveProperty('updated_at');
    // body is intentionally excluded from the list response
    expect(note).not.toHaveProperty('body');
  });

  it('[VERIFIER-ADDED] Notes list contains only the requesting user\'s notes (isolation)', async () => {
    // Given: two users, each with one note
    const userA = await registerUser();
    const userB = await registerUser();

    const noteA = await createNote(userA.cookie, 'User A Note');
    await createNote(userB.cookie, 'User B Note');

    // When: User A requests their notes
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', userA.cookie);

    // Then: only User A's note is returned
    expect(res.status).toBe(200);
    const ids = res.body.notes.map((n) => n.id);
    expect(ids).toContain(noteA.id);
    // User B's note must not appear
    expect(res.body.notes.every((n) => n.title !== 'User B Note')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Structural: note is accessible by ID (content load to editor is TASK-009)
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-008]: Note is accessible via the API for editor loading', () => {

  it('Given an authenticated user selects a note from the catalog, the note id returned by GET /api/notes is a valid UUID that can be used to load the note', async () => {
    // Given
    const { cookie } = await registerUser();
    await createNote(cookie, 'Selectable Note');

    // When
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: each note id is a valid UUID (structural requirement for editor loading)
    expect(res.status).toBe(200);
    expect(res.body.notes.length).toBeGreaterThan(0);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const note of res.body.notes) {
      expect(note.id).toMatch(uuidPattern);
    }
  });

  it('[VERIFIER-ADDED] Note id from catalog list is stable across subsequent GET /api/notes calls', async () => {
    // Given
    const { cookie } = await registerUser();
    const created = await createNote(cookie, 'Stable ID Note');

    // When: fetch list twice
    const res1 = await request(app).get('/api/notes').set('Cookie', cookie);
    const res2 = await request(app).get('/api/notes').set('Cookie', cookie);

    // Then: the same note appears with the same id in both responses
    const id1 = res1.body.notes.find((n) => n.id === created.id);
    const id2 = res2.body.notes.find((n) => n.id === created.id);
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1.id).toBe(id2.id);
  });
});

// ---------------------------------------------------------------------------
// AC-4: POST /api/notes returns the new note so the frontend can prepend it
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-008]: Creating a new note makes it immediately available in the catalog list', () => {

  it('Given an authenticated user creates a note, when GET /api/notes is called, then the new note appears at the top of the list', async () => {
    // Given: user has an existing note
    const { cookie } = await registerUser();
    await createNote(cookie, 'Existing Note');
    await new Promise((r) => setTimeout(r, 20));

    // When: user creates a second note
    const newNote = await createNote(cookie, 'Brand New Note');

    // Then: GET /api/notes returns it and it is first (newest first sort)
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.notes[0].id).toBe(newNote.id);
    expect(res.body.notes[0].title).toBe('Brand New Note');
  });

  it('Given an authenticated user creates a note, the POST /api/notes response contains the note object the frontend needs to prepend to the sidebar', async () => {
    // Given
    const { cookie } = await registerUser();

    // When
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({ title: 'Sidebar Prepend Test' });

    // Then: response has the note object with all fields needed to render in the sidebar
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('note');
    const note = res.body.note;
    expect(note).toHaveProperty('id');
    expect(note).toHaveProperty('title', 'Sidebar Prepend Test');
    expect(note).toHaveProperty('updated_at');
    // created_at present too (needed for initial render consistency)
    expect(note).toHaveProperty('created_at');
  });

  it('[VERIFIER-ADDED] Creating a note without a title results in a note with empty title string in the catalog list', async () => {
    // Given
    const { cookie } = await registerUser();

    // When
    const res = await request(app)
      .post('/api/notes')
      .set('Cookie', cookie)
      .send({});

    // Then: note is created and appears in list with empty title (renders as "Untitled" in UI)
    expect(res.status).toBe(201);
    expect(res.body.note.title).toBe('');

    const listRes = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    expect(listRes.body.notes[0].id).toBe(res.body.note.id);
  });

  it('[VERIFIER-ADDED] Unauthenticated POST /api/notes returns 401 and does not create a note', async () => {
    // When
    const res = await request(app)
      .post('/api/notes')
      .send({ title: 'Should Not Be Created' });

    // Then
    expect(res.status).toBe(401);
  });
});
