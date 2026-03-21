/**
 * Verifier Acceptance Tests — TASK-005: Ownership Guard and Data Isolation
 *
 * REQ-011: Per-user data isolation (ADR-006)
 *
 * These tests are authored by the Verifier. They operate exclusively through
 * the system's public HTTP interface (supertest against the Express app) and
 * directly against the database via Sequelize (for scope verification and
 * RLS structural checks). No implementation internals are accessed.
 *
 * Acceptance criteria covered:
 *   AC-1  ownershipGuard middleware applied to all routes; unauthenticated → 401
 *   AC-2  Authenticated user's own resource: guard passes (HTTP path reaches handler)
 *   AC-3  Cross-user access returns 404, not 403 — resource existence not disclosed
 *   AC-4  Sequelize forUser scopes isolate records by user_id
 *   AC-5  User A cannot access User B's note, folder, or version by direct ID (404)
 *   AC-6  List endpoint scope isolation verified at model layer (HTTP-level deferred to TASK-009/TASK-017)
 *   AC-7  RLS is structurally active; app.current_user_id is set per request
 *
 * Fitness Functions: FF-D26, FF-D27, FF-D28, FF-D29, FF-D30, FF-D31
 */

'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note, Folder, NoteVersion } = require('../../src/models');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Register a new user and return { cookie, userId }.
 * Registration creates a session automatically (TASK-003 behaviour).
 */
async function registerAndLogin(overrides = {}) {
  const defaults = {
    username: 'testuser',
    email: 'testuser@example.com',
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

/** Create a Note directly via Sequelize (bypasses route stubs). */
async function createNoteDirectly(userId, attrs = {}) {
  return Note.create({
    user_id: userId,
    title: attrs.title || 'Test Note',
    body: attrs.body || 'Test body',
  });
}

/** Create a Folder directly via Sequelize. */
async function createFolderDirectly(userId, attrs = {}) {
  return Folder.create({
    user_id: userId,
    name: attrs.name || 'Test Folder',
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await sequelize.authenticate();
});

afterEach(async () => {
  await NoteVersion.destroy({ where: {}, force: true });
  await Note.destroy({ where: {}, force: true });
  await Folder.destroy({ where: {}, force: true });
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1 [REQ-011]: Unauthenticated requests return 401
// Negative test: guard must reject requests with no session before any handler runs.
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-011]: unauthenticated requests are blocked at all resource routes', () => {
  const FAKE_ID = '00000000-0000-0000-0000-000000000001';

  it('GET /api/notes/:id returns 401 without session (not 404 or 500)', async () => {
    // Given: no session cookie is present
    // When: a GET request is sent to a note ID path
    // Then: 401 is returned — the guard stops the request before it reaches ownershipGuard
    const res = await request(app).get(`/api/notes/${FAKE_ID}`);
    expect(res.status).toBe(401);
  });

  it('PUT /api/notes/:id returns 401 without session', async () => {
    const res = await request(app).put(`/api/notes/${FAKE_ID}`).send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/notes/:id returns 401 without session', async () => {
    const res = await request(app).delete(`/api/notes/${FAKE_ID}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/notes/:id/versions returns 401 without session', async () => {
    const res = await request(app).get(`/api/notes/${FAKE_ID}/versions`);
    expect(res.status).toBe(401);
  });

  it('POST /api/notes/:id/check-version returns 401 without session', async () => {
    const res = await request(app).post(`/api/notes/${FAKE_ID}/check-version`);
    expect(res.status).toBe(401);
  });

  it('GET /api/folders/:id returns 401 without session', async () => {
    const res = await request(app).get(`/api/folders/${FAKE_ID}`);
    expect(res.status).toBe(401);
  });

  it('PUT /api/folders/:id returns 401 without session', async () => {
    const res = await request(app).put(`/api/folders/${FAKE_ID}`).send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/folders/:id returns 401 without session', async () => {
    const res = await request(app).delete(`/api/folders/${FAKE_ID}`);
    expect(res.status).toBe(401);
  });

  it('401 response body has the correct shape — { error: "Authentication required" }', async () => {
    // The error body must not expose session state or resource details.
    const res = await request(app).get(`/api/notes/${FAKE_ID}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Authentication required');
  });
});

// ---------------------------------------------------------------------------
// AC-2 [REQ-011]: Ownership guard passes for the resource's actual owner
// The route handlers are stubs (TASK-005 scope; TASK-006/009/017 implement them),
// so the positive path is evidenced by the guard NOT returning 404. The 500 from
// the stub handler confirms the guard ran next() — a trivially permissive
// implementation that skips ownership checks would also pass the auth test
// but this confirms guard→handler sequencing is correct.
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-011]: ownership guard allows the resource owner through', () => {
  it('GET /api/notes/:id — guard passes for the owning user (reaches stub handler, returns 500 not 404)', async () => {
    // Given: a user with an authenticated session owns a note
    // When: that user requests the note by its ID
    // Then: ownershipGuard passes (returns next()); TASK-008 implemented the handler, which now returns 200.
    //
    // ESC-001 (2026-03-20): assertion updated from toBe(500) to toBe(200).
    // The original assertion was correct when TASK-005 was written — the handler was a stub
    // throwing Error('Not implemented'). TASK-008 iter-2 implemented GET /api/notes/:id;
    // the handler now returns HTTP 200 with the note body. The underlying criterion (guard passes
    // for the owner and does NOT return 404 or 401) is still satisfied and verified by the
    // two not.toBe assertions below. This is a [VERIFIER-ADDED] test updated per escalation.
    const user = await registerAndLogin({ username: 'owner', email: 'owner@example.com' });
    const note = await createNoteDirectly(user.userId);

    const res = await request(app)
      .get(`/api/notes/${note.id}`)
      .set('Cookie', user.cookie);

    // The guard passed (not 404/401) and the implemented handler ran (200).
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
    // TASK-008 implements the handler — 200 is expected (replaces original 500 stub assertion).
    expect(res.status).toBe(200);
  });

  it('GET /api/notes/:id/versions — guard passes for the note owner (reaches handler, returns 200 not 404)', async () => {
    // Given: a user with a session owns a note
    // When: that user requests the note's version list
    // Then: ownershipGuard passes; the implemented handler returns 200.
    //
    // ESC-002 (2026-03-21): assertion updated from toBe(500) to toBe(200).
    // The original assertion was correct when TASK-005 was written — the handler was a stub.
    // The versions route handler now returns HTTP 200 with the versions list. The underlying
    // criterion (guard passes for the owner and does NOT return 404 or 401) is still satisfied.
    const user = await registerAndLogin({ username: 'owner', email: 'owner@example.com' });
    const note = await createNoteDirectly(user.userId);

    const res = await request(app)
      .get(`/api/notes/${note.id}/versions`)
      .set('Cookie', user.cookie);

    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });

  it('GET /api/folders/:id — guard passes for the owning user, returns 200 with folder data', async () => {
    // Given: a user with a session owns a folder
    // When: that user requests the folder by ID
    // Then: ownershipGuard passes; handler returns 200 with the folder data
    const user = await registerAndLogin({ username: 'owner', email: 'owner@example.com' });
    const folder = await createFolderDirectly(user.userId);

    const res = await request(app)
      .get(`/api/folders/${folder.id}`)
      .set('Cookie', user.cookie);

    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC-3 [REQ-011]: Cross-user access returns 404, not 403
// Must not reveal whether a resource exists.
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-011]: cross-user access returns exactly 404 — resource existence not disclosed', () => {
  it('GET /api/notes/:id — User A receives 404 for User B\'s note (not 403)', async () => {
    // Given: User B owns a note; User A has a valid session
    // When: User A requests User B's note by direct ID
    // Then: 404 is returned (not 403 — no resource enumeration)
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const noteB = await createNoteDirectly(userB.userId);

    const res = await request(app)
      .get(`/api/notes/${noteB.id}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it('GET /api/notes/:id/versions — User A receives 404 for User B\'s note versions', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const noteB = await createNoteDirectly(userB.userId);

    const res = await request(app)
      .get(`/api/notes/${noteB.id}/versions`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it('GET /api/folders/:id — User A receives 404 for User B\'s folder', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const folderB = await createFolderDirectly(userB.userId);

    const res = await request(app)
      .get(`/api/folders/${folderB.id}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it('404 error body is { error: "Not found" } — no additional fields that could leak existence', async () => {
    // The body must be exactly { error: "Not found" }.
    // A body with "message" or other fields could encode existence information.
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const noteB = await createNoteDirectly(userB.userId);

    const res = await request(app)
      .get(`/api/notes/${noteB.id}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    // Must not expose the actual resource ID or owner information.
    expect(JSON.stringify(res.body)).not.toContain(noteB.id);
    expect(JSON.stringify(res.body)).not.toContain(userB.userId);
  });

  it('[VERIFIER-ADDED] non-existent resource ID also returns 404 — indistinguishable from cross-user case', async () => {
    // Given: a valid session but a UUID that has never been assigned to any note
    // When: the user requests that ID
    // Then: 404 is returned — identical response to the cross-user case
    const user = await registerAndLogin({ username: 'owner', email: 'owner@example.com' });
    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    const res = await request(app)
      .get(`/api/notes/${nonExistentId}`)
      .set('Cookie', user.cookie);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('[VERIFIER-ADDED] non-existent folder ID also returns 404 — indistinguishable from cross-user case', async () => {
    const user = await registerAndLogin({ username: 'owner', email: 'owner@example.com' });
    const nonExistentId = '00000000-0000-4000-8000-000000000001';

    const res = await request(app)
      .get(`/api/folders/${nonExistentId}`)
      .set('Cookie', user.cookie);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

// ---------------------------------------------------------------------------
// AC-4 [REQ-011]: Sequelize forUser scopes isolate records by user_id
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-011]: Sequelize forUser scopes filter by user_id', () => {
  it('Note.scope("forUser") returns notes for the specified user only', async () => {
    // Given: User A has 2 notes; User B has 1 note
    // When: forUser scope is applied with User A's ID
    // Then: exactly 2 notes are returned, all owned by User A
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });

    await createNoteDirectly(userA.userId, { title: 'A1' });
    await createNoteDirectly(userA.userId, { title: 'A2' });
    await createNoteDirectly(userB.userId, { title: 'B1' });

    const aNotes = await Note.scope({ method: ['forUser', userA.userId] }).findAll();

    expect(aNotes).toHaveLength(2);
    expect(aNotes.every((n) => n.user_id === userA.userId)).toBe(true);
  });

  it('Note.scope("forUser") does not return the other user\'s notes', async () => {
    // Negative case: User A's scope must not include User B's note.
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });

    await createNoteDirectly(userA.userId);
    const noteBId = (await createNoteDirectly(userB.userId)).id;

    const aNotes = await Note.scope({ method: ['forUser', userA.userId] }).findAll();
    const returnedIds = aNotes.map((n) => n.id);

    expect(returnedIds).not.toContain(noteBId);
  });

  it('Folder.scope("forUser") returns folders for the specified user only', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });

    await createFolderDirectly(userA.userId, { name: 'A folder' });
    await createFolderDirectly(userB.userId, { name: 'B folder 1' });
    await createFolderDirectly(userB.userId, { name: 'B folder 2' });

    const aFolders = await Folder.scope({ method: ['forUser', userA.userId] }).findAll();
    const bFolders = await Folder.scope({ method: ['forUser', userB.userId] }).findAll();

    expect(aFolders).toHaveLength(1);
    expect(bFolders).toHaveLength(2);
    expect(aFolders.every((f) => f.user_id === userA.userId)).toBe(true);
  });

  it('[VERIFIER-ADDED] forUser scope returns empty array when user has no records — not null, not error', async () => {
    // Negative case: a user with no notes must get an empty array, not a 500 or null.
    const user = await registerAndLogin({ username: 'newuser', email: 'new@example.com' });

    const notes = await Note.scope({ method: ['forUser', user.userId] }).findAll();

    expect(Array.isArray(notes)).toBe(true);
    expect(notes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-5 [REQ-011]: Direct ID access across users returns 404 on all mutating verbs
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-011]: User A cannot access User B\'s resources by direct ID on any verb', () => {
  it('User A cannot PUT (edit) User B\'s note', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const noteB = await createNoteDirectly(userB.userId);

    const res = await request(app)
      .put(`/api/notes/${noteB.id}`)
      .set('Cookie', userA.cookie)
      .send({ title: 'hijacked' });

    expect(res.status).toBe(404);
    // Verify note title was not changed.
    const refreshed = await Note.findByPk(noteB.id);
    expect(refreshed.title).not.toBe('hijacked');
  });

  it('User A cannot DELETE User B\'s note', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const noteB = await createNoteDirectly(userB.userId);

    const res = await request(app)
      .delete(`/api/notes/${noteB.id}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
    // Verify the note still exists in the database after the rejected request.
    const stillExists = await Note.findByPk(noteB.id);
    expect(stillExists).not.toBeNull();
  });

  it('User A cannot PUT (rename) User B\'s folder', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const folderB = await createFolderDirectly(userB.userId, { name: 'original name' });

    const res = await request(app)
      .put(`/api/folders/${folderB.id}`)
      .set('Cookie', userA.cookie)
      .send({ name: 'hijacked' });

    expect(res.status).toBe(404);
    const refreshed = await Folder.findByPk(folderB.id);
    expect(refreshed.name).toBe('original name');
  });

  it('User A cannot DELETE User B\'s folder', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const folderB = await createFolderDirectly(userB.userId);

    const res = await request(app)
      .delete(`/api/folders/${folderB.id}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
    const stillExists = await Folder.findByPk(folderB.id);
    expect(stillExists).not.toBeNull();
  });

  it('User A cannot POST check-version on User B\'s note', async () => {
    const userA = await registerAndLogin({ username: 'usera', email: 'a@example.com' });
    const userB = await registerAndLogin({ username: 'userb', email: 'b@example.com' });
    const noteB = await createNoteDirectly(userB.userId);

    const res = await request(app)
      .post(`/api/notes/${noteB.id}/check-version`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// AC-6 [REQ-011]: List endpoints return only the requesting user's resources
// HTTP-level list isolation deferred to TASK-009 (GET /api/notes) and TASK-017
// (GET /api/folders) — route handlers are stubs at TASK-005 scope.
// The model-scope isolation (AC-4 above) is the verifiable evidence at this stage.
//
// [VERIFIER-ADDED] The test below documents the deferred scope and verifies that
// the list routes are auth-gated (AC-1) so isolation at the HTTP level is enforced
// once handlers are implemented.
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-011]: list routes require authentication — isolation will apply when handlers are implemented', () => {
  it('[VERIFIER-ADDED] GET /api/notes returns 401 without session (auth gate on list route confirmed)', async () => {
    // Given: no session
    // When: list request is sent to /api/notes
    // Then: 401 — the auth gate is in place; isolation logic inside the handler
    // will be verified in TASK-009.
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(401);
  });

  it('[VERIFIER-ADDED] GET /api/folders returns 401 without session (auth gate on list route confirmed)', async () => {
    const res = await request(app).get('/api/folders');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-7 [REQ-011]: RLS is active at the database level (structural + SET LOCAL)
// ---------------------------------------------------------------------------

describe('AC-7 [REQ-011]: RLS is structurally active on all three protected tables', () => {
  it('notes table has rowsecurity=true AND relforcerowsecurity=true', async () => {
    // Given: migrations have been applied
    // When: pg_class is queried for the notes table
    // Then: both RLS flags are true — the DB will enforce policies for non-superusers
    const [row] = await sequelize.query(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'notes'",
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it('folders table has rowsecurity=true AND relforcerowsecurity=true', async () => {
    const [row] = await sequelize.query(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'folders'",
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it('note_versions table has rowsecurity=true AND relforcerowsecurity=true', async () => {
    const [row] = await sequelize.query(
      "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'note_versions'",
      { type: sequelize.constructor.QueryTypes.SELECT }
    );
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it('[VERIFIER-ADDED] RLS policies exist on all three protected tables (at least one policy per table)', async () => {
    // A table with FORCE ROW LEVEL SECURITY but no policies would deny ALL access.
    // Confirm each table has at least one policy configured.
    const tables = ['notes', 'folders', 'note_versions'];
    for (const tableName of tables) {
      const policies = await sequelize.query(
        `SELECT policyname FROM pg_policies WHERE tablename = '${tableName}'`,
        { type: sequelize.constructor.QueryTypes.SELECT }
      );
      expect(policies.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('[VERIFIER-ADDED] rlsContext middleware sets app.current_user_id — verified via rlsContext integration test baseline', async () => {
    // The rlsContext integration tests (tests/integration/rlsContext.test.js) already
    // verify the SET LOCAL behaviour in detail. This test confirms the structural
    // prerequisite: the rlsContext module exists and is imported without error.
    const rlsContext = require('../../src/middleware/rlsContext');
    expect(typeof rlsContext).toBe('function');
  });
});
