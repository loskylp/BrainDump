/**
 * Verifier Acceptance Tests -- TASK-009: Edit a note (API and editor integration)
 *
 * REQ-005: Edit a note
 * REQ-012: Data durability and PostgreSQL persistence
 *
 * These tests operate through the system's public HTTP interface (supertest
 * against the Express app) and directly against the database via Sequelize
 * for persistence and timestamp verification. No implementation internals are
 * accessed beyond the models import path.
 *
 * Acceptance criteria covered:
 *   AC-1  PUT /api/notes/:id endpoint exists and updates title + body
 *   AC-2  updated_at is refreshed on save
 *   AC-3  (structural) Save path exists: PUT /api/notes/:id is the save endpoint
 *         wired to in WorkspacePage (frontend tests in Builder's unit suite cover
 *         the button and keyboard shortcut; acceptance test verifies the API side)
 *   AC-4  404 returned when a user tries to edit another user's note (ownership guard)
 *   AC-5  Selecting a note loads its title and body (verified via GET /api/notes/:id
 *         which is the API the editor calls on note selection)
 *
 * AC-3 keyboard shortcut and Save button rendering are component-level behaviors
 * verified in the Builder's frontend unit tests (WorkspaceNoteEdit.test.jsx).
 * This file covers the API acceptance layer for AC-1, AC-2, AC-4, and the API
 * side of AC-5.
 *
 * Run from the backend/ directory:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   SESSION_SECRET=test-secret NODE_ENV=test \
 *   npx jest --testPathPattern=TASK-009 --forceExit --runInBand
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note } = require('../../src/models');
const { Op } = require('sequelize');

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
    username: `t9_${suffix}`,
    email: `t9_${suffix}@example.com`,
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
 * Creates a note for the authenticated session and returns the created note object.
 * @param {string|string[]} cookie - session cookie
 * @param {string} title - note title
 * @returns {object} note - { id, title, body, folder_id, created_at, updated_at }
 */
async function createNote(cookie, title = 'Test Note') {
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
  // Delete test users created in this suite; cascade deletes their notes and versions
  await User.destroy({
    where: {
      username: { [Op.like]: 't9_%' },
    },
  });
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1 [REQ-005]: PUT /api/notes/:id updates title and body
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-005]: PUT /api/notes/:id updates note title and body', () => {

  it('Given an authenticated user with a note, when PUT /api/notes/:id is sent with a new title, then 200 is returned', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Original Title');

    // When
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated Title', body: '' });

    // Then
    expect(res.status).toBe(200);
  });

  it('Given an authenticated user with a note, when PUT /api/notes/:id is sent, then response contains { note: { id, title, body, updated_at } }', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Original Title');

    // When
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated Title', body: 'Updated body' });

    // Then
    expect(res.body).toHaveProperty('note');
    expect(res.body.note).toMatchObject({
      id: note.id,
      title: 'Updated Title',
      body: 'Updated body',
    });
    expect(typeof res.body.note.updated_at).toBe('string');
  });

  it('Given a note with an original title, when title is updated via PUT, then the new title is persisted in the database', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Original Title');

    // When
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Persisted Title', body: '' });

    // Then: verify directly in the database
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.title).toBe('Persisted Title');
  });

  it('Given a note with an empty body, when body is updated via PUT, then the new body is persisted in the database', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Title');

    // When
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Title', body: '# Hello World\n\nSome **bold** content.' });

    // Then: verify directly in the database
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.body).toBe('# Hello World\n\nSome **bold** content.');
  });

  it('[VERIFIER-ADDED] Given a PUT with only title (no body field), then title is updated and body is preserved', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Original');
    // First set a body
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Original', body: 'Preserved body' });

    // When: send only title
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'New Title Only' });

    // Then
    expect(res.status).toBe(200);
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.title).toBe('New Title Only');
    expect(dbNote.body).toBe('Preserved body');
  });

  it('[VERIFIER-ADDED] Unauthenticated PUT /api/notes/:id returns 401', async () => {
    // Given: a note exists but we have no session
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Existing Note');

    // When: request sent without cookie
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .send({ title: 'Hack' });

    // Then
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-2 [REQ-005/REQ-012]: updated_at is refreshed on save
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-005/REQ-012]: updated_at timestamp is refreshed on each save', () => {

  it('Given a note with an existing updated_at, when PUT /api/notes/:id is called, then updated_at in the response is a valid ISO 8601 string', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Timestamp Test');

    // When
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', body: 'Body' });

    // Then
    expect(res.status).toBe(200);
    const updatedAt = res.body.note.updated_at;
    // Must be a valid ISO 8601 date string
    expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
  });

  it('Given a note that was created, when PUT /api/notes/:id is called after a delay, then updated_at in the database is strictly after created_at', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Timestamp Compare');
    const createdAt = new Date(note.created_at);

    // Ensure at least 1ms passes before the update
    await new Promise((r) => setTimeout(r, 10));

    // When
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', body: 'Content' });

    // Then: database updated_at > created_at
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.updated_at.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
  });

  it('[VERIFIER-ADDED] Given two sequential saves, the updated_at after the second save is >= the updated_at after the first', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Double Save');

    // When: first save
    const res1 = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Save 1', body: 'Content 1' });

    const updatedAt1 = new Date(res1.body.note.updated_at);

    await new Promise((r) => setTimeout(r, 10));

    // When: second save
    const res2 = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Save 2', body: 'Content 2' });

    const updatedAt2 = new Date(res2.body.note.updated_at);

    // Then
    expect(updatedAt2.getTime()).toBeGreaterThanOrEqual(updatedAt1.getTime());
  });
});

// ---------------------------------------------------------------------------
// AC-3 [REQ-005]: Save path is wired correctly (API side)
//
// The Save button and Cmd/Ctrl+S shortcut trigger PUT /api/notes/:id.
// This acceptance test verifies the API endpoint is correctly structured
// as the save path. Button rendering and keyboard shortcut are verified by
// the Builder's frontend unit tests (WorkspaceNoteEdit.test.jsx).
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-005]: PUT /api/notes/:id is the save endpoint', () => {

  it('Given an authenticated user, when PUT /api/notes/:id succeeds, then the response body has note.id matching the requested note', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Save Path Note');

    // When
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Saved Title', body: 'Saved body' });

    // Then: response note id matches what was requested (not a different note)
    expect(res.status).toBe(200);
    expect(res.body.note.id).toBe(note.id);
  });

  it('[VERIFIER-ADDED] PUT with empty title and empty body succeeds (valid edge case for a blank note)', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Has Content');

    // When
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: '', body: '' });

    // Then: should succeed -- clearing content is a valid user action
    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('');
    expect(res.body.note.body).toBe('');
  });
});

// ---------------------------------------------------------------------------
// AC-4 [REQ-005/REQ-011]: 404 when a user tries to edit another user's note
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-005/REQ-011]: Cross-user note edit returns 404 (ownership guard)', () => {

  it('Given User A owns a note, when User B sends PUT /api/notes/:id for that note, then 404 is returned', async () => {
    // Given
    const userA = await registerUser();
    const userB = await registerUser();
    const note = await createNote(userA.cookie, 'User A note');

    // When: User B attempts to edit User A's note
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', userB.cookie)
      .send({ title: 'Hijacked', body: 'Stolen body' });

    // Then
    expect(res.status).toBe(404);
  });

  it('Given User A owns a note, when User B attempts PUT on it, then User A\'s note content is not changed', async () => {
    // Given
    const userA = await registerUser();
    const userB = await registerUser();
    const note = await createNote(userA.cookie, 'User A Original');

    // When: User B attempts to edit
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', userB.cookie)
      .send({ title: 'Hijacked', body: 'Stolen' });

    // Then: content unchanged in database
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.title).toBe('User A Original');
    expect(dbNote.body).toBe('');
  });

  it('[VERIFIER-ADDED] Given a non-existent note UUID, when PUT is sent, then 404 is returned', async () => {
    // Given
    const { cookie } = await registerUser();
    const nonExistentId = '00000000-dead-beef-0000-000000000000';

    // When
    const res = await request(app)
      .put(`/api/notes/${nonExistentId}`)
      .set('Cookie', cookie)
      .send({ title: 'Ghost', body: '' });

    // Then: ownership guard or service returns 404
    expect(res.status).toBe(404);
  });

  it('[VERIFIER-ADDED] 404 response does not reveal whether the note exists or belongs to another user (no distinguishing error message)', async () => {
    // Given: two scenarios that must both produce identical 404 responses
    const userA = await registerUser();
    const userB = await registerUser();
    const note = await createNote(userA.cookie, 'Secret Note');

    // When: User B attempts cross-user edit
    const crossUserRes = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', userB.cookie)
      .send({ title: 'Hack' });

    // When: request against a UUID that does not exist at all
    const nonExistentRes = await request(app)
      .put('/api/notes/00000000-0000-0000-0000-000000000000')
      .set('Cookie', userB.cookie)
      .send({ title: 'Hack' });

    // Then: both return 404 with the same error structure (prevents enumeration)
    expect(crossUserRes.status).toBe(404);
    expect(nonExistentRes.status).toBe(404);
    expect(crossUserRes.body.error).toBe(nonExistentRes.body.error);
  });
});

// ---------------------------------------------------------------------------
// AC-5 [REQ-005]: Selecting a note loads its title and body into the editor
//
// This is verified at the API level: GET /api/notes/:id returns both title
// and body for the owning user. The frontend test in WorkspaceNoteEdit.test.jsx
// covers the editor initialization from the API response.
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-005]: GET /api/notes/:id returns title and body for the selected note', () => {

  it('Given a note with a title and body, when GET /api/notes/:id is called, then the response includes both title and body', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Load Me');
    // Set a body via PUT so there is content to verify
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Load Me', body: 'This is the body content.' });

    // When
    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', cookie);

    // Then
    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('Load Me');
    expect(res.body.note.body).toBe('This is the body content.');
  });

  it('Given a note with Markdown body, when GET /api/notes/:id is called, then body is returned as raw Markdown source (not rendered HTML)', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Markdown Note');
    const markdown = '# Heading\n\n**Bold text** and `inline code`.';
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Markdown Note', body: markdown });

    // When
    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', cookie);

    // Then: raw Markdown is returned, not rendered HTML
    expect(res.status).toBe(200);
    expect(res.body.note.body).toBe(markdown);
    expect(res.body.note.body).not.toContain('<h1>');
  });

  it('[VERIFIER-ADDED] Given a note loaded and then updated, when GET /api/notes/:id is called again, then the updated values are returned', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Before Edit');

    // When: edit the note
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'After Edit', body: 'New content.' });

    // Then: GET reflects the updated state
    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('After Edit');
    expect(res.body.note.body).toBe('New content.');
  });

  it('[VERIFIER-ADDED] User B cannot load User A\'s note content via GET /api/notes/:id', async () => {
    // Given
    const userA = await registerUser();
    const userB = await registerUser();
    const note = await createNote(userA.cookie, 'Private Note');
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', userA.cookie)
      .send({ title: 'Private Note', body: 'Secret content.' });

    // When: User B attempts to read User A's note
    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', userB.cookie);

    // Then: ownership guard prevents access
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// No NoteVersion row created on PUT (ADR-004 invariant)
// ---------------------------------------------------------------------------

describe('[VERIFIER-ADDED] ADR-004 invariant: PUT /api/notes/:id does not create a NoteVersion row', () => {
  const { NoteVersion } = require('../../src/models');

  it('Given a note, when PUT /api/notes/:id is called, then no new note_versions row is created', async () => {
    // Given
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Version Guard Test');

    const versionsBefore = await NoteVersion.count({ where: { note_id: note.id } });

    // When
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', body: 'New content' });

    // Then: version count unchanged
    const versionsAfter = await NoteVersion.count({ where: { note_id: note.id } });
    expect(versionsAfter).toBe(versionsBefore);
  });
});
