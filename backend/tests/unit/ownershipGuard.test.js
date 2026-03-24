/**
 * Unit tests for ownershipGuard middleware factory (TASK-005).
 *
 * Verifies contract:
 *   - Loads the resource identified by req.params[paramName] from the given model
 *   - Calls next() and attaches resource to req.resource when user_id matches session
 *   - Returns 404 when the resource does not exist
 *   - Returns 404 when the resource's user_id differs from req.session.userId
 *     (does NOT return 403 — prevents resource enumeration, ADR-006)
 *   - Never calls next() on rejection
 *
 * Models are mocked — no database required for these tests.
 *
 * Fitness Functions: FF-D26, FF-D27, FF-D28
 */

'use strict';

const ownershipGuard = require('../../src/middleware/ownershipGuard');

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';

/**
 * Builds a mock Sequelize model with a findByPk stub.
 * @param {object|null} resolvesWith - The value findByPk resolves with
 * @returns {{ findByPk: jest.Mock }}
 */
function mockModel(resolvesWith) {
  return {
    findByPk: jest.fn(() => Promise.resolve(resolvesWith)),
  };
}

/**
 * Builds a mock req with session and params.
 * @param {string} userId - The authenticated user's ID
 * @param {string} paramValue - The resource ID in params
 * @param {string} [paramName='id'] - The param key name
 */
function mockReq(userId, paramValue, paramName = 'id') {
  return {
    session: { userId },
    params: { [paramName]: paramValue },
  };
}

/**
 * Builds a minimal mock res with spy methods that support chaining.
 */
function mockRes() {
  const res = { _status: null, _body: null };
  res.json = jest.fn((body) => { res._body = body; return res; });
  res.status = jest.fn((code) => { res._status = code; return res; });
  return res;
}

// ---------------------------------------------------------------------------
// Jest module mocking
// ---------------------------------------------------------------------------

// ownershipGuard calls require('../models') internally.
// We mock the models module so tests can control what findByPk returns.
jest.mock('../../src/models', () => ({
  Note: null,     // replaced per-test
  Folder: null,   // replaced per-test
  NoteVersion: null,
}));

const models = require('../../src/models');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ownershipGuard(modelName, paramName)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('when the resource exists and is owned by the requesting user', () => {
    it('calls next() with no error', async () => {
      const resource = { id: NOTE_ID, user_id: USER_A };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // no error argument
    });

    it('attaches the loaded resource to req.resource', async () => {
      const resource = { id: NOTE_ID, user_id: USER_A };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(req.resource).toBe(resource);
    });

    it('does not write a response on success', async () => {
      const resource = { id: NOTE_ID, user_id: USER_A };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('looks up the resource using the correct param name', async () => {
      const resource = { id: NOTE_ID, user_id: USER_A };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID, 'id');
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(models.Note.findByPk).toHaveBeenCalledWith(NOTE_ID);
    });
  });

  describe('when the resource does not exist', () => {
    it('returns 404 when findByPk resolves to null', async () => {
      models.Note = mockModel(null);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(404);
      expect(res._body).toEqual({ error: 'Not found' });
    });

    it('does not call next() when resource is not found', async () => {
      models.Note = mockModel(null);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('when the resource belongs to a different user (cross-user access)', () => {
    it('returns 404 (not 403) to prevent resource enumeration', async () => {
      // Resource exists but is owned by USER_B; USER_A is the requester
      const resource = { id: NOTE_ID, user_id: USER_B };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(404);
      expect(res._body).toEqual({ error: 'Not found' });
    });

    it('does not call next() on cross-user access', async () => {
      const resource = { id: NOTE_ID, user_id: USER_B };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('does not attach the foreign resource to req.resource', async () => {
      const resource = { id: NOTE_ID, user_id: USER_B };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(req.resource).toBeUndefined();
    });
  });

  describe('model name resolution', () => {
    it('resolves "Note" from the models registry', async () => {
      const resource = { id: NOTE_ID, user_id: USER_A };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(models.Note.findByPk).toHaveBeenCalled();
    });

    it('resolves "Folder" from the models registry', async () => {
      const FOLDER_ID = 'ffffffff-0000-0000-0000-000000000004';
      const resource = { id: FOLDER_ID, user_id: USER_A };
      models.Folder = mockModel(resource);

      const middleware = ownershipGuard('Folder', 'id');
      const req = mockReq(USER_A, FOLDER_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(models.Folder.findByPk).toHaveBeenCalledWith(FOLDER_ID);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('custom param name', () => {
    it('reads the resource ID from a non-default param name', async () => {
      const VERSION_ID = 'eeeeeeee-0000-0000-0000-000000000005';
      const resource = { id: VERSION_ID, user_id: USER_A };
      models.NoteVersion = mockModel(resource);

      const middleware = ownershipGuard('NoteVersion', 'versionId');
      const req = {
        session: { userId: USER_A },
        params: { id: NOTE_ID, versionId: VERSION_ID },
      };
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(models.NoteVersion.findByPk).toHaveBeenCalledWith(VERSION_ID);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('BUG-001: UUID format validation', () => {
    const malformedIds = [
      'not-a-uuid',
      'undefined',
      'null',
      '123',
      '../etc/passwd',
      'aaaaaaaa-zzzz-0000-0000-000000000001',
      '',
    ];

    it.each(malformedIds)(
      'returns 404 for malformed ID "%s" without calling findByPk',
      async (badId) => {
        const resource = { id: NOTE_ID, user_id: USER_A };
        models.Note = mockModel(resource);

        const middleware = ownershipGuard('Note', 'id');
        const req = mockReq(USER_A, badId);
        const res = mockRes();
        const next = jest.fn();

        await middleware(req, res, next);

        expect(res._status).toBe(404);
        expect(res._body).toEqual({ error: 'Not found' });
        expect(next).not.toHaveBeenCalled();
        expect(models.Note.findByPk).not.toHaveBeenCalled();
      }
    );

    it('returns 404 when param is undefined (missing param)', async () => {
      models.Note = mockModel(null);

      const middleware = ownershipGuard('Note', 'id');
      const req = { session: { userId: USER_A }, params: {} };
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res._status).toBe(404);
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts a valid UUID and proceeds to findByPk', async () => {
      const resource = { id: NOTE_ID, user_id: USER_A };
      models.Note = mockModel(resource);

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(models.Note.findByPk).toHaveBeenCalledWith(NOTE_ID);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('calls next(err) when findByPk throws', async () => {
      const dbError = new Error('DB connection lost');
      models.Note = {
        findByPk: jest.fn(() => Promise.reject(dbError)),
      };

      const middleware = ownershipGuard('Note', 'id');
      const req = mockReq(USER_A, NOTE_ID);
      const res = mockRes();
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(dbError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
