/**
 * Regression tests for BUG-001: malformed resource IDs and empty-string folderId.
 *
 * Two defects fixed:
 *   1. ownershipGuard did not validate UUID format before calling findByPk,
 *      causing a Sequelize/Postgres cast error (500) on non-UUID strings.
 *   2. noteService.updateNote did not normalize empty-string folderId to null,
 *      unlike createNote which already had `rawFolderId || null`. This caused
 *      a DB foreign-key violation when the frontend sent folderId: ''.
 *
 * Both tests exercise the public HTTP API via supertest.
 */

'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { sequelize } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register a user and return the session cookie.
 */
async function registerAndLogin(overrides = {}) {
  const defaults = {
    username: 'buguser',
    email: 'buguser@example.com',
    password: 'Test1234!',
  };
  const payload = { ...defaults, ...overrides };

  const res = await request(app)
    .post('/api/auth/register')
    .send(payload)
    .expect(201);

  const cookie = res.headers['set-cookie'];
  const userId = res.body.user?.id || res.body.id;
  return { cookie, userId };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BUG-001 regression', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ---- Fix 1: UUID format validation in ownershipGuard ----

  describe('ownershipGuard rejects malformed resource IDs with 404', () => {
    let cookie;

    beforeAll(async () => {
      ({ cookie } = await registerAndLogin());
    });

    const malformedIds = [
      'not-a-uuid',
      'undefined',
      'null',
      '123',
      '../etc/passwd',
      'aaaaaaaa-zzzz-0000-0000-000000000001', // wrong hex chars
    ];

    it.each(malformedIds)(
      'GET /api/notes/%s returns 404 (not 500)',
      async (badId) => {
        const res = await request(app)
          .get(`/api/notes/${badId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
      }
    );

    it.each(malformedIds)(
      'PUT /api/notes/%s returns 404 (not 500)',
      async (badId) => {
        const res = await request(app)
          .put(`/api/notes/${badId}`)
          .set('Cookie', cookie)
          .send({ title: 'test' });

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
      }
    );

    it.each(malformedIds)(
      'DELETE /api/notes/%s returns 404 (not 500)',
      async (badId) => {
        const res = await request(app)
          .delete(`/api/notes/${badId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not found' });
      }
    );
  });

  // ---- Fix 2: empty-string folderId normalised to null in updateNote ----

  describe('updateNote normalises empty-string folderId to null', () => {
    let cookie;
    let noteId;

    beforeAll(async () => {
      ({ cookie } = await registerAndLogin({
        username: 'buguser2',
        email: 'buguser2@example.com',
      }));

      // Create a note to update
      const res = await request(app)
        .post('/api/notes')
        .set('Cookie', cookie)
        .send({ title: 'BUG-001 test note' })
        .expect(201);

      noteId = res.body.id;
    });

    it('accepts folderId: "" and sets folder_id to null (not 500)', async () => {
      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Cookie', cookie)
        .send({ folderId: '' });

      expect(res.status).toBe(200);
      expect(res.body.folder_id).toBeNull();
    });

    it('still accepts folderId: null explicitly', async () => {
      const res = await request(app)
        .put(`/api/notes/${noteId}`)
        .set('Cookie', cookie)
        .send({ folderId: null });

      expect(res.status).toBe(200);
      expect(res.body.folder_id).toBeNull();
    });
  });
});
