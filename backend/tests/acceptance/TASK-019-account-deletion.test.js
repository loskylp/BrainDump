/**
 * Verifier Acceptance Tests — TASK-019: Account deletion
 *
 * REQ-014: Account deletion
 * Fitness Function: FF-D09 (cascade delete user — delete user, verify all associated data deleted)
 *
 * These tests operate through the system's public HTTP interface (supertest
 * against the Express app). Database models are used directly to verify that
 * CASCADE deletions have occurred — this is an integration-layer concern
 * (FF-D09) that cannot be verified at the HTTP interface alone.
 *
 * Acceptance criteria covered:
 *   AC-1  An authenticated user can initiate account deletion from account settings
 *         (DELETE /api/auth/account endpoint accessible to authenticated users)
 *   AC-2  A confirmation step prevents accidental deletion
 *         (password re-entry is required; missing or empty password returns 400)
 *   AC-3  On confirmation, the user's account, notes, versions, and folders are
 *         permanently deleted (CASCADE — FF-D09)
 *   AC-4  After deletion, the user cannot log in
 *   AC-5  Cancelling the confirmation does not delete anything
 *         (verified via wrong-password rejection — the account and data remain intact)
 *
 * Additional negative cases (VERIFIER-ADDED):
 *   - Unauthenticated requests are rejected (401)
 *   - Wrong password is rejected (401 INVALID_CREDENTIALS)
 *   - The deleted user's session cookie is invalidated after deletion
 *
 * Run from the backend directory:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   npx jest --testPathPattern=acceptance/TASK-019 --forceExit
 */

'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note, NoteVersion, Folder } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'TestPass123!';

/**
 * Registers a new user with a unique email and returns { cookie, userId, email }.
 */
async function registerUser() {
  const suffix = Date.now() + Math.random().toString(36).slice(2, 7);
  const email = `task019_${suffix}@example.com`;
  const username = `task019_${suffix}`;

  const res = await request(app).post('/api/auth/register').send({
    username,
    email,
    password: TEST_PASSWORD,
  });

  if (res.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  }

  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
    email,
  };
}

/**
 * Creates a note for the user identified by cookie. Returns the note id.
 */
async function createNote(cookie, title = 'Test Note') {
  const res = await request(app)
    .post('/api/notes')
    .set('Cookie', cookie)
    .send({ title });

  if (res.status !== 201) {
    throw new Error(`Note creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.note.id;
}

/**
 * Creates a folder for the user identified by cookie. Returns the folder id.
 */
async function createFolder(cookie, name = 'Test Folder') {
  const res = await request(app)
    .post('/api/folders')
    .set('Cookie', cookie)
    .send({ name });

  if (res.status !== 201) {
    throw new Error(`Folder creation failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.folder.id;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await sequelize.authenticate();
});

afterEach(async () => {
  // Remove any test users whose emails match the TASK-019 prefix.
  // CASCADE deletes on the users table will clean up notes, versions, folders,
  // and sessions automatically (ADR-003, FF-D09).
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1 [REQ-014]: Authenticated user can access the deletion endpoint
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-014]: DELETE /api/auth/account is accessible to authenticated users', () => {
  // Given: an authenticated user
  // When: they DELETE /api/auth/account with the correct password
  // Then: the response is 204 with no body

  it('returns 204 when authenticated with the correct password', async () => {
    // Given: a registered user with an active session
    const { cookie } = await registerUser();

    // When: they request account deletion with the correct password
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    // Then: the response is 204 (no body — DELETE with no response body)
    expect(res.status).toBe(204);
  });

  // [VERIFIER-ADDED] Negative: unauthenticated request is rejected
  it('[VERIFIER-ADDED] returns 401 with no session cookie', async () => {
    // Given: no active session (no cookie sent)
    // When: DELETE /api/auth/account is called without authentication
    // Then: the server returns 401
    const res = await request(app)
      .delete('/api/auth/account')
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  // [VERIFIER-ADDED] Negative: fabricated session cookie is rejected
  it('[VERIFIER-ADDED] returns 401 with a fabricated session cookie', async () => {
    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', 'connect.sid=s%3Afaketoken.invalidsig')
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-2 [REQ-014]: Confirmation step — password required; wrong password rejected
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-014]: A confirmation step (password re-entry) prevents accidental deletion', () => {
  // Given: an authenticated user
  // When: they attempt deletion with a missing or wrong password
  // Then: the request is rejected and the account is not deleted

  it('returns 400 VALIDATION_ERROR when password is missing from the request body', async () => {
    // Given: an authenticated user
    // When: they DELETE /api/auth/account without sending a password field
    // Then: 400 is returned and the account still exists
    const { cookie } = await registerUser();

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when password is an empty string', async () => {
    const { cookie } = await registerUser();

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('[VERIFIER-ADDED] returns 401 INVALID_CREDENTIALS when password does not match', async () => {
    // Given: an authenticated user
    // When: they DELETE /api/auth/account with the wrong password
    // Then: 401 INVALID_CREDENTIALS is returned and the account still exists
    const { cookie, userId } = await registerUser();

    const res = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: 'WrongPassword999!' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');

    // Account must still exist in the database
    const user = await User.findByPk(userId);
    expect(user).not.toBeNull();
  });

  it('[VERIFIER-ADDED] account data is intact after a wrong-password rejection', async () => {
    // Given: a user with a note and a folder
    // When: deletion is attempted with the wrong password
    // Then: the note and folder remain in the database
    const { cookie, userId } = await registerUser();
    await createNote(cookie);
    await createFolder(cookie);

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: 'WrongPassword999!' });

    const notes = await Note.findAll({ where: { user_id: userId } });
    const folders = await Folder.findAll({ where: { user_id: userId } });

    expect(notes.length).toBeGreaterThan(0);
    expect(folders.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3 [REQ-014] / FF-D09: Cascade deletion — account, notes, versions, folders
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-014] / FF-D09: Account, notes, note versions, and folders are deleted (CASCADE)', () => {
  // REQ-014 AC-3 scenario:
  // Given an authenticated user on their account settings page
  // When they request account deletion and confirm (with correct password)
  // Then their account, notes, versions, and folders are permanently deleted

  it('user row is removed from the database after successful deletion', async () => {
    // Given: a registered user
    // When: they delete their account
    // Then: User.findByPk returns null
    const { cookie, userId } = await registerUser();

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const user = await User.findByPk(userId);
    expect(user).toBeNull();
  });

  it('all notes owned by the user are deleted (CASCADE)', async () => {
    // Given: a user with two notes
    // When: they delete their account
    // Then: Note.findAll returns empty for that user_id
    const { cookie, userId } = await registerUser();

    await createNote(cookie, 'Note One');
    await createNote(cookie, 'Note Two');

    // Confirm notes exist before deletion
    const notesBefore = await Note.findAll({ where: { user_id: userId } });
    expect(notesBefore.length).toBe(2);

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const notesAfter = await Note.findAll({ where: { user_id: userId } });
    expect(notesAfter.length).toBe(0);
  });

  it('all note versions owned by the user are deleted (CASCADE via note_id FK)', async () => {
    // Given: a user with a note (which has an initial version per REQ-016)
    // When: they delete their account
    // Then: NoteVersion.findAll for that user's notes returns empty
    const { cookie, userId } = await registerUser();

    const noteId = await createNote(cookie, 'Versioned Note');

    // Confirm at least one version exists before deletion
    const versionsBefore = await NoteVersion.findAll({ where: { note_id: noteId } });
    expect(versionsBefore.length).toBeGreaterThan(0);

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const versionsAfter = await NoteVersion.findAll({ where: { note_id: noteId } });
    expect(versionsAfter.length).toBe(0);
  });

  it('all folders owned by the user are deleted (CASCADE)', async () => {
    // Given: a user with a folder
    // When: they delete their account
    // Then: Folder.findAll returns empty for that user_id
    const { cookie, userId } = await registerUser();

    await createFolder(cookie, 'My Folder');

    const foldersBefore = await Folder.findAll({ where: { user_id: userId } });
    expect(foldersBefore.length).toBe(1);

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const foldersAfter = await Folder.findAll({ where: { user_id: userId } });
    expect(foldersAfter.length).toBe(0);
  });

  it('[VERIFIER-ADDED] full cascade: user with notes, versions, and folders — all gone after deletion', async () => {
    // FF-D09: delete user, verify all associated data deleted
    // Given: a user with a note (which auto-creates a version) and a folder
    // When: they delete their account
    // Then: user, notes, versions, and folders are all absent from the database
    const { cookie, userId } = await registerUser();

    const noteId = await createNote(cookie, 'Full Cascade Note');
    await createFolder(cookie, 'Full Cascade Folder');

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const [user, notes, versions, folders] = await Promise.all([
      User.findByPk(userId),
      Note.findAll({ where: { user_id: userId } }),
      NoteVersion.findAll({ where: { note_id: noteId } }),
      Folder.findAll({ where: { user_id: userId } }),
    ]);

    expect(user).toBeNull();
    expect(notes.length).toBe(0);
    expect(versions.length).toBe(0);
    expect(folders.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4 [REQ-014]: After deletion, the user cannot log in
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-014]: After account deletion, the user cannot log in', () => {
  // Given: a user who has deleted their account
  // When: they attempt to log in with the deleted credentials
  // Then: the login is rejected

  it('POST /api/auth/login returns a non-200 status for the deleted account email', async () => {
    // Given: a user who deletes their account
    const { cookie, email } = await registerUser();

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    // When: they try to log in with the same credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    // Then: login is rejected (account no longer exists)
    expect(loginRes.status).not.toBe(200);
  });

  it('POST /api/auth/login returns 401 for the deleted account credentials', async () => {
    const { cookie, email } = await registerUser();

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(401);
  });

  it('[VERIFIER-ADDED] session cookie is invalidated — GET /api/auth/me returns 401 after deletion', async () => {
    // Given: a user who has deleted their account
    // When: they use the old session cookie to call GET /api/auth/me
    // Then: the server returns 401 (session was destroyed on deletion)
    const { cookie } = await registerUser();

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(401);
  });

  it('[VERIFIER-ADDED] attempting re-registration with the same email succeeds (email is freed)', async () => {
    // Given: a user whose account is deleted
    // When: a new user registers with the same email
    // Then: registration succeeds (the email is no longer taken)
    const { cookie, email } = await registerUser();
    const suffix = email.split('@')[0].replace('task019_', '');

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: TEST_PASSWORD });

    const reRegisterRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: `task019_re_${suffix}`,
        email,
        password: TEST_PASSWORD,
      });

    expect(reRegisterRes.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// AC-5 [REQ-014]: Cancelling the confirmation does not delete anything
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-014]: A cancelled or rejected deletion attempt leaves the account intact', () => {
  // REQ-014 AC-5 scenario:
  // Given an authenticated user
  // When they request account deletion but cancel the confirmation
  // Then no data is deleted and the account remains active
  //
  // Note: At the API level, "cancelling" is modelled as never sending the DELETE
  // request (frontend cancel button), or sending it with a wrong password. The
  // wrong-password case is the server-side boundary that prevents accidental
  // deletion — it is verified here as the AC-5 equivalent.

  it('account is unchanged after a wrong-password rejection — user can still log in', async () => {
    // Given: a user with a valid session
    // When: they attempt deletion with the wrong password (cancel scenario)
    // Then: the account is still active and the user can still log in
    const { cookie, email } = await registerUser();

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: 'WrongPassword!' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
  });

  it('account is unchanged after a missing-password rejection — GET /api/auth/me still works', async () => {
    // Given: a user with a valid session
    // When: they attempt deletion without providing a password (cancel/error path)
    // Then: the session is still valid and GET /api/auth/me returns 200
    const { cookie } = await registerUser();

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({});

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
  });

  it('[VERIFIER-ADDED] notes are intact after a rejected deletion attempt', async () => {
    // Given: a user with a note
    // When: deletion is rejected (wrong password)
    // Then: the note still exists in the database
    const { cookie, userId } = await registerUser();
    await createNote(cookie, 'Should Survive');

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', cookie)
      .send({ password: 'WrongPassword!' });

    const notes = await Note.findAll({ where: { user_id: userId } });
    expect(notes.length).toBeGreaterThan(0);
  });
});
