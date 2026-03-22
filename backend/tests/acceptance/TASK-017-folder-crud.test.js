/**
 * Verifier Acceptance Tests — TASK-017: Folder organization
 *
 * REQ-009: Organize notes in folders
 * REQ-011: Per-user data isolation
 * REQ-012: Data durability and PostgreSQL persistence
 *
 * These tests operate through the system's public HTTP interface (supertest
 * against the Express app) and directly against the database via Sequelize
 * for persistence verification. No implementation internals are accessed
 * beyond the models import path.
 *
 * Acceptance criteria covered:
 *   AC-1   POST /api/folders with valid name returns 201; folder appears in GET /api/folders
 *   AC-2   Folder appears in sidebar catalog navigation (GET /api/folders response structure)
 *   AC-3   PUT /api/folders/:id with new name returns 200; name is updated
 *   AC-4   PUT /api/notes/:id with { folderId } moves note into folder; GET /api/notes/:id returns updated folder_id
 *   AC-5   PUT /api/notes/:id with { folderId: null } removes note from folder
 *   AC-6   GET /api/notes returns notes with correct folder_id values (unfiled notes have folder_id: null)
 *   AC-7   DELETE /api/folders/:id returns 204; notes that were in the folder get folder_id: null
 *   AC-8   POST /api/folders rejects empty/whitespace-only name with 400 VALIDATION_ERROR
 *   AC-9   GET/PUT/DELETE /api/folders/:id with another user's folder returns 404 (ownership guard)
 *   AC-10  Nested folder creation is not available (single-level only)
 *
 * Run from the backend/ directory:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   SESSION_SECRET=test-secret NODE_ENV=test \
 *   npx jest --testPathPattern=TASK-017 --forceExit --runInBand
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request  = require('supertest');
const app      = require('../../src/app');
const { sequelize, Note, Folder } = require('../../src/models');

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
    username: `t17_${suffix}`,
    email:    `t17_${suffix}@example.com`,
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
 * Creates a folder for the authenticated session and returns the created folder object.
 */
async function createFolder(cookie, name = 'Test Folder') {
  const res = await request(app)
    .post('/api/folders')
    .set('Cookie', cookie)
    .send({ name });
  if (res.status !== 201) {
    throw new Error(`createFolder failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.folder;
}

/**
 * Creates a note for the authenticated session and returns the created note object.
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
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await sequelize.authenticate();
});

afterEach(async () => {
  // Remove all test users (cascades to folders and notes)
  await sequelize.query(`DELETE FROM users WHERE email LIKE 't17_%@example.com'`);
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1: POST /api/folders with valid name returns 201; folder appears in GET /api/folders
// REQ-009: Organize notes in folders
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-009]: Authenticated user can create a folder via POST /api/folders', () => {
  test('Given an authenticated user, when POST /api/folders with a valid name, then 201 is returned', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: the user creates a folder with a valid name
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Research' });

    // Then: 201 is returned
    expect(res.status).toBe(201);
  });

  test('Given a created folder, the response body contains a "folder" key with id, name, timestamps', async () => {
    // Given: an authenticated user creates a folder
    const { cookie } = await registerUser();

    // When: the folder is created
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Projects' });

    // Then: the response has the required structure
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('folder');
    expect(res.body.folder).toHaveProperty('id');
    expect(res.body.folder).toHaveProperty('name', 'Projects');
    expect(res.body.folder).toHaveProperty('created_at');
    expect(res.body.folder).toHaveProperty('updated_at');
  });

  test('Given a created folder, it appears in GET /api/folders', async () => {
    // Given: an authenticated user creates a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Reading List');

    // When: the user fetches their folder list
    const res = await request(app)
      .get('/api/folders')
      .set('Cookie', cookie);

    // Then: the created folder appears in the list
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('folders');
    const ids = res.body.folders.map(f => f.id);
    expect(ids).toContain(folder.id);
  });

  test('Given a created folder, name stored in database matches the submitted name (trimmed)', async () => {
    // Given: an authenticated user creates a folder with leading/trailing whitespace
    const { cookie } = await registerUser();
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: '  Archive  ' });

    // Then: the name is stored trimmed
    expect(res.status).toBe(201);
    expect(res.body.folder.name).toBe('Archive');

    const dbFolder = await Folder.findByPk(res.body.folder.id);
    expect(dbFolder.name).toBe('Archive');
  });

  test('[VERIFIER-ADDED] Given no session, when POST /api/folders, then 401 is returned', async () => {
    // Given: no session cookie
    // When: POST /api/folders is called without authentication
    const res = await request(app)
      .post('/api/folders')
      .send({ name: 'Sneaky Folder' });

    // Then: 401 is returned — unauthenticated access is rejected
    expect(res.status).toBe(401);
  });

  test('[VERIFIER-ADDED] Given no session, POST /api/folders does not persist any folder', async () => {
    // Given: no session exists
    const countBefore = await Folder.count();

    // When: POST /api/folders is called without a session
    await request(app)
      .post('/api/folders')
      .send({ name: 'Ghost Folder' });

    // Then: no folder was created
    const countAfter = await Folder.count();
    expect(countAfter).toBe(countBefore);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Folder appears in sidebar catalog navigation (GET /api/folders response structure)
// REQ-009
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-009]: Folder appears in workspace navigation via GET /api/folders', () => {
  test('Given an authenticated user with no folders, GET /api/folders returns an empty array', async () => {
    // Given: a new user with no folders
    const { cookie } = await registerUser();

    // When: the user fetches their folder list
    const res = await request(app)
      .get('/api/folders')
      .set('Cookie', cookie);

    // Then: an empty array is returned (not 404)
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('folders');
    expect(res.body.folders).toEqual([]);
  });

  test('Given multiple folders created, GET /api/folders returns them all sorted alphabetically', async () => {
    // Given: an authenticated user creates three folders
    const { cookie } = await registerUser();
    await createFolder(cookie, 'Zebra Notes');
    await createFolder(cookie, 'Alpha Notes');
    await createFolder(cookie, 'Middle Notes');

    // When: the user fetches their folder list
    const res = await request(app)
      .get('/api/folders')
      .set('Cookie', cookie);

    // Then: all three folders are returned in alphabetical order
    expect(res.status).toBe(200);
    const names = res.body.folders.map(f => f.name);
    expect(names).toContain('Alpha Notes');
    expect(names).toContain('Middle Notes');
    expect(names).toContain('Zebra Notes');
    // Alphabetical sort: Alpha < Middle < Zebra
    const alphaIdx  = names.indexOf('Alpha Notes');
    const middleIdx = names.indexOf('Middle Notes');
    const zebraIdx  = names.indexOf('Zebra Notes');
    expect(alphaIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(zebraIdx);
  });

  test('Given a folder, GET /api/folders/:id returns { folder } with 200', async () => {
    // Given: an authenticated user creates a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Single Folder');

    // When: the user fetches the single folder
    const res = await request(app)
      .get(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // Then: 200 and the folder are returned
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('folder');
    expect(res.body.folder.id).toBe(folder.id);
    expect(res.body.folder.name).toBe('Single Folder');
  });

  test('[VERIFIER-ADDED] GET /api/folders without authentication returns 401', async () => {
    // Given: no session
    // When: GET /api/folders is called without a cookie
    const res = await request(app).get('/api/folders');

    // Then: 401 — not accessible to unauthenticated callers
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-3: PUT /api/folders/:id with new name returns 200; folder is renamed
// REQ-009
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-009]: Authenticated user can rename a folder via PUT /api/folders/:id', () => {
  test('Given an existing folder, when PUT /api/folders/:id with a new name, then 200 is returned', async () => {
    // Given: an authenticated user creates a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Original Name');

    // When: the user renames the folder
    const res = await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Renamed Folder' });

    // Then: 200 is returned
    expect(res.status).toBe(200);
  });

  test('Given an existing folder, after rename the response and database reflect the new name', async () => {
    // Given: an authenticated user creates a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Before Rename');

    // When: the user renames the folder
    const res = await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', cookie)
      .send({ name: 'After Rename' });

    // Then: the response contains the updated name
    expect(res.status).toBe(200);
    expect(res.body.folder.name).toBe('After Rename');

    // And: the database reflects the updated name
    const dbFolder = await Folder.findByPk(folder.id);
    expect(dbFolder.name).toBe('After Rename');
  });

  test('[VERIFIER-ADDED] Given an existing folder, renaming with whitespace-padded name trims the name', async () => {
    // Given: an authenticated user has a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Untrimmed Target');

    // When: PUT with whitespace-padded name
    const res = await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', cookie)
      .send({ name: '  Trimmed Result  ' });

    // Then: the name is stored trimmed
    expect(res.status).toBe(200);
    expect(res.body.folder.name).toBe('Trimmed Result');
  });

  test('[VERIFIER-ADDED] PUT /api/folders/:id with empty name returns 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user has a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Will Not Be Renamed');

    // When: PUT with an empty name (negative case — empty name must be rejected)
    const res = await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', cookie)
      .send({ name: '' });

    // Then: 400 VALIDATION_ERROR — empty name is rejected
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
  });

  test('[VERIFIER-ADDED] PUT /api/folders/:id with whitespace-only name returns 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user has a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Will Stay');

    // When: PUT with whitespace-only name (negative case)
    const res = await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', cookie)
      .send({ name: '   ' });

    // Then: 400 VALIDATION_ERROR
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// AC-4: PUT /api/notes/:id with { folderId } moves the note into the folder
// REQ-009
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-009]: Authenticated user can move a note into a folder via PUT /api/notes/:id', () => {
  test('Given a note and a folder, when PUT /api/notes/:id with folderId, then note is associated', async () => {
    // Given: an authenticated user has a note and a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Destination Folder');
    const note   = await createNote(cookie, 'Note to Move');

    // When: the user updates the note with the folderId
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // Then: 200 is returned
    expect(res.status).toBe(200);
  });

  test('Given a note moved into a folder, GET /api/notes/:id returns the updated folder_id', async () => {
    // Given: an authenticated user has a note and a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Target Folder');
    const note   = await createNote(cookie, 'Filing This Note');

    // When: the note is moved into the folder
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // Then: GET /api/notes/:id returns folder_id matching the folder
    const getRes = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.note.folder_id).toBe(folder.id);
  });

  test('Given a note moved into a folder, the database row reflects the updated folder_id', async () => {
    // Given: an authenticated user has a note and a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'DB Verify Folder');
    const note   = await createNote(cookie, 'DB Verify Note');

    // When: the note is moved into the folder
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // Then: the database row reflects the new folder_id
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.folder_id).toBe(folder.id);
  });

  test('[VERIFIER-ADDED] Moving a note into a non-existent folder does not succeed silently', async () => {
    // Given: an authenticated user has a note; a non-existent folderId
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Orphan Note');
    const bogusId = '00000000-0000-0000-0000-000000000000';

    // When: the note is assigned to a non-existent folder
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: bogusId });

    // Then: the request does not return 200 (negative case — DB FK will reject it)
    expect(res.status).not.toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC-5: PUT /api/notes/:id with { folderId: null } removes the note from the folder
// REQ-009
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-009]: Authenticated user can remove a note from a folder by setting folderId to null', () => {
  test('Given a note in a folder, when PUT /api/notes/:id with folderId: null, note moves to root', async () => {
    // Given: an authenticated user has a note inside a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Holding Folder');
    const note   = await createNote(cookie, 'Note to Unfile');

    // Move note into folder first
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: the user removes the note from the folder (folderId: null)
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: null });

    // Then: 200 is returned
    expect(res.status).toBe(200);
  });

  test('Given a note removed from its folder, GET /api/notes/:id returns folder_id: null', async () => {
    // Given: an authenticated user has a note inside a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Temp Folder');
    const note   = await createNote(cookie, 'Will Be Unfiled');

    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: folderId is set to null
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: null });

    // Then: the note's folder_id is null
    const getRes = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.note.folder_id).toBeNull();
  });

  test('Given a note removed from its folder, the database row has folder_id = NULL', async () => {
    // Given: an authenticated user has a note inside a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Remove From Me');
    const note   = await createNote(cookie, 'Removing from Folder');

    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: folderId is explicitly nulled
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: null });

    // Then: the database row has folder_id = NULL
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote.folder_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-6: GET /api/notes returns notes with correct folder_id values
// REQ-009 / REQ-008
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-009/REQ-008]: GET /api/notes returns correct folder_id values for each note', () => {
  test('Given notes with and without folders, GET /api/notes returns correct folder_id for each', async () => {
    // Given: an authenticated user has two notes — one in a folder, one at root
    const { cookie } = await registerUser();
    const folder    = await createFolder(cookie, 'Organized Folder');
    const inFolder  = await createNote(cookie, 'Inside Folder');
    const atRoot    = await createNote(cookie, 'At Root Level');

    // Move one note into the folder
    await request(app)
      .put(`/api/notes/${inFolder.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: all notes are fetched
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const notes = res.body.notes;

    const folderedNote = notes.find(n => n.id === inFolder.id);
    const rootNote     = notes.find(n => n.id === atRoot.id);

    // Then: the foldered note has the correct folder_id
    expect(folderedNote).toBeDefined();
    expect(folderedNote.folder_id).toBe(folder.id);

    // And: the root note has folder_id: null
    expect(rootNote).toBeDefined();
    expect(rootNote.folder_id).toBeNull();
  });

  test('[VERIFIER-ADDED] A newly created note (no folder assigned) has folder_id: null in GET /api/notes', async () => {
    // Given: an authenticated user creates a note without specifying a folder
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Unfiled New Note');

    // When: the note list is fetched
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: the note has folder_id: null
    const found = res.body.notes.find(n => n.id === note.id);
    expect(found).toBeDefined();
    expect(found.folder_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-7: DELETE /api/folders/:id returns 204; notes in deleted folder get folder_id: null
// REQ-009 / REQ-012
// ---------------------------------------------------------------------------

describe('AC-7 [REQ-009/REQ-012]: DELETE /api/folders/:id deletes folder; notes fall back to root', () => {
  test('Given an existing folder, when DELETE /api/folders/:id, then 204 is returned with no body', async () => {
    // Given: an authenticated user has a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Deletable Folder');

    // When: the user deletes the folder
    const res = await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // Then: 204 is returned with no body
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  test('Given a deleted folder, it no longer appears in GET /api/folders', async () => {
    // Given: an authenticated user has a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Gone Folder');

    // When: the folder is deleted
    await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // Then: the folder is not returned in the list
    const res = await request(app)
      .get('/api/folders')
      .set('Cookie', cookie);

    const ids = res.body.folders.map(f => f.id);
    expect(ids).not.toContain(folder.id);
  });

  test('Given a deleted folder, GET /api/folders/:id returns 404', async () => {
    // Given: an authenticated user creates and deletes a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Ephemeral Folder');
    await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // When: the deleted folder is fetched by ID
    const res = await request(app)
      .get(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // Then: 404 — the folder is gone
    expect(res.status).toBe(404);
  });

  test('Given notes in a deleted folder, notes get folder_id: null via DB ON DELETE SET NULL', async () => {
    // Given: an authenticated user has a folder with two notes inside
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Parent Folder');
    const note1  = await createNote(cookie, 'Child Note 1');
    const note2  = await createNote(cookie, 'Child Note 2');

    await request(app)
      .put(`/api/notes/${note1.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });
    await request(app)
      .put(`/api/notes/${note2.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: the folder is deleted
    await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // Then: both notes still exist but have folder_id: null in the database
    const dbNote1 = await Note.findByPk(note1.id);
    const dbNote2 = await Note.findByPk(note2.id);
    expect(dbNote1).not.toBeNull();
    expect(dbNote1.folder_id).toBeNull();
    expect(dbNote2).not.toBeNull();
    expect(dbNote2.folder_id).toBeNull();
  });

  test('Given notes formerly in a deleted folder, GET /api/notes returns them with folder_id: null', async () => {
    // Given: an authenticated user has notes in a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Temporary Home');
    const note   = await createNote(cookie, 'Orphaned Note');

    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: the folder is deleted and the note list is fetched
    await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: the orphaned note has folder_id: null
    const found = res.body.notes.find(n => n.id === note.id);
    expect(found).toBeDefined();
    expect(found.folder_id).toBeNull();
  });

  test('[VERIFIER-ADDED] DELETE /api/folders/:id removes only the folder row, not the notes themselves', async () => {
    // Given: an authenticated user has a note inside a folder
    const { cookie } = await registerUser();
    const folder = await createFolder(cookie, 'Notes Survive Folder');
    const note   = await createNote(cookie, 'Survivor Note');

    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ folderId: folder.id });

    // When: the folder is deleted
    await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', cookie);

    // Then: the note still exists — only the folder is gone
    const dbNote = await Note.findByPk(note.id);
    expect(dbNote).not.toBeNull();
    expect(dbNote.title).toBe('Survivor Note');
  });
});

// ---------------------------------------------------------------------------
// AC-8: POST /api/folders rejects empty/whitespace-only name with 400 VALIDATION_ERROR
// REQ-009
// ---------------------------------------------------------------------------

describe('AC-8 [REQ-009]: POST /api/folders rejects invalid (empty/whitespace) folder names', () => {
  test('Given an authenticated user, when POST /api/folders with empty name, then 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: a folder is created with an empty name (negative case)
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: '' });

    // Then: 400 VALIDATION_ERROR is returned
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
  });

  test('Given an authenticated user, when POST /api/folders with whitespace-only name, then 400', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: a folder is created with whitespace-only name (negative case)
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: '   ' });

    // Then: 400 VALIDATION_ERROR
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
  });

  test('Given an authenticated user, when POST /api/folders with no name field, then 400', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();

    // When: a folder is created with no name field at all (negative case)
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({});

    // Then: 400 VALIDATION_ERROR
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'VALIDATION_ERROR');
  });

  test('[VERIFIER-ADDED] Invalid name POST does not persist any folder in the database', async () => {
    // Given: an authenticated user session
    const { cookie } = await registerUser();
    const countBefore = await Folder.count();

    // When: a folder is created with an empty name
    await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: '' });

    // Then: no folder was created
    const countAfter = await Folder.count();
    expect(countAfter).toBe(countBefore);
  });
});

// ---------------------------------------------------------------------------
// AC-9: Ownership guard — another user's folder returns 404 on GET/PUT/DELETE
// REQ-009 / REQ-011
// ---------------------------------------------------------------------------

describe('AC-9 [REQ-009/REQ-011]: Ownership guard enforced — another user\'s folder returns 404', () => {
  test('Given User A owns a folder, when User B does GET /api/folders/:id, then 404', async () => {
    // Given: User A creates a folder
    const userA = await registerUser();
    const folder = await createFolder(userA.cookie, 'User A Private Folder');

    // And: User B exists
    const userB = await registerUser();

    // When: User B attempts to GET User A's folder by direct ID
    const res = await request(app)
      .get(`/api/folders/${folder.id}`)
      .set('Cookie', userB.cookie);

    // Then: 404 — resource existence is not disclosed
    expect(res.status).toBe(404);
  });

  test('Given User A owns a folder, when User B does PUT /api/folders/:id, then 404', async () => {
    // Given: User A creates a folder
    const userA = await registerUser();
    const folder = await createFolder(userA.cookie, 'User A Rename Target');

    // And: User B exists
    const userB = await registerUser();

    // When: User B attempts to rename User A's folder
    const res = await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', userB.cookie)
      .send({ name: 'Hijacked Name' });

    // Then: 404
    expect(res.status).toBe(404);
  });

  test('Given User A owns a folder, when User B does DELETE /api/folders/:id, then 404', async () => {
    // Given: User A creates a folder
    const userA = await registerUser();
    const folder = await createFolder(userA.cookie, 'User A Deletion Target');

    // And: User B exists
    const userB = await registerUser();

    // When: User B attempts to delete User A's folder
    const res = await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', userB.cookie);

    // Then: 404
    expect(res.status).toBe(404);
  });

  test('Given User A owns a folder, User B DELETE attempt does not delete the folder', async () => {
    // Given: User A creates a folder
    const userA = await registerUser();
    const folder = await createFolder(userA.cookie, 'Integrity Protected Folder');

    // And: User B attempts to delete it
    const userB = await registerUser();
    await request(app)
      .delete(`/api/folders/${folder.id}`)
      .set('Cookie', userB.cookie);

    // When: the folder is looked up in the database directly
    const dbFolder = await Folder.findByPk(folder.id);

    // Then: the folder still exists — the delete had no effect
    expect(dbFolder).not.toBeNull();
  });

  test('Given User A owns a folder, User B PUT attempt does not rename the folder', async () => {
    // Given: User A creates a folder
    const userA = await registerUser();
    const folder = await createFolder(userA.cookie, 'Intact Name');

    // And: User B attempts to rename it
    const userB = await registerUser();
    await request(app)
      .put(`/api/folders/${folder.id}`)
      .set('Cookie', userB.cookie)
      .send({ name: 'Hijacked Name' });

    // When: the folder is read directly from the database
    const dbFolder = await Folder.findByPk(folder.id);

    // Then: the name is unchanged
    expect(dbFolder.name).toBe('Intact Name');
  });

  test('GET /api/folders returns only the authenticated user\'s folders — not another user\'s', async () => {
    // Given: User A creates a folder; User B creates a different folder
    const userA = await registerUser();
    const userB = await registerUser();
    const folderA = await createFolder(userA.cookie, 'User A Only Folder');
    const folderB = await createFolder(userB.cookie, 'User B Only Folder');

    // When: User A fetches their folder list
    const resA = await request(app)
      .get('/api/folders')
      .set('Cookie', userA.cookie);

    // Then: User A sees their folder but not User B's
    const idsForA = resA.body.folders.map(f => f.id);
    expect(idsForA).toContain(folderA.id);
    expect(idsForA).not.toContain(folderB.id);

    // And: User B sees their folder but not User A's
    const resB = await request(app)
      .get('/api/folders')
      .set('Cookie', userB.cookie);

    const idsForB = resB.body.folders.map(f => f.id);
    expect(idsForB).toContain(folderB.id);
    expect(idsForB).not.toContain(folderA.id);
  });
});

// ---------------------------------------------------------------------------
// AC-10: Nested folder creation is not available (single-level only)
// REQ-009
// ---------------------------------------------------------------------------

describe('AC-10 [REQ-009]: Nested folder creation is not supported — single-level only', () => {
  test('[VERIFIER-ADDED] The folders schema has no parent_folder_id column (nesting structurally prevented)', async () => {
    // Given: the database schema for the folders table
    // When: we inspect the Folder model's field definitions
    const attributes = Folder.getAttributes ? Folder.getAttributes() : Folder.rawAttributes;

    // Then: there is no parent_folder_id column — nesting is structurally absent
    expect(Object.keys(attributes)).not.toContain('parent_folder_id');
  });

  test('[VERIFIER-ADDED] POST /api/folders with a parentFolderId field is silently ignored — no nesting', async () => {
    // Given: an authenticated user has a folder
    const { cookie } = await registerUser();
    const parentFolder = await createFolder(cookie, 'Parent');

    // When: a second folder is created with a parentFolderId field in the body
    // (the API should not support this field — it is ignored, not an error)
    const res = await request(app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Child Attempt', parentFolderId: parentFolder.id });

    // Then: the folder is created at root level (201), but the parentFolderId is ignored
    // The created folder has no parent association — confirmed by its absence from the response
    expect(res.status).toBe(201);
    expect(res.body.folder).not.toHaveProperty('parent_folder_id');
  });
});
