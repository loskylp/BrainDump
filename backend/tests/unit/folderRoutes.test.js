/**
 * Unit tests for folder routes (TASK-017).
 *
 * Verifies the route contracts:
 *   GET    /api/folders         -- list user's folders (200)
 *   POST   /api/folders         -- create folder (201) or reject empty name (400)
 *   GET    /api/folders/:id     -- get single folder (200) or 404
 *   PUT    /api/folders/:id     -- rename folder (200) or reject empty name (400) or 404
 *   DELETE /api/folders/:id     -- delete folder (204) or 404
 *   All routes return 401 when unauthenticated
 *
 * The Folder model and all middleware are mocked — no database required.
 *
 * Mocking strategy for ownershipGuard:
 *   ownershipGuard is a factory called once at router-require time. A mutable
 *   guardBehaviour object lets tests flip between pass and block without
 *   re-requiring the router.
 *
 * REQ-009 (Folder organization), ADR-003 (single-level folders), ADR-006 (ownership guard)
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FOLDER_ID = 'cccccccc-0000-0000-0000-000000000003';

// ---------------------------------------------------------------------------
// Mutable guard state
// ---------------------------------------------------------------------------

/**
 * Controls ownershipGuard behaviour for the current test.
 *   mode: 'pass'  -- attaches a stub resource to req.resource and calls next()
 *   mode: 'block' -- responds 404 immediately
 */
const guardBehaviour = { mode: 'pass' };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Folder model — mocked before the router is required
jest.mock('../../src/models', () => {
  const Folder = {
    scope: jest.fn().mockReturnThis(),
    findAll: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  };

  return { Folder };
});

// authenticate: allow all requests through with test userId
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, _res, next) => {
    req.session = { userId: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  })
);

// rlsContext: no-op
jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

/**
 * Mock ownershipGuard factory.
 * Returns middleware that reads guardBehaviour on each request so tests can
 * switch behaviour without re-requiring the router.
 *
 * The stub resource uses a mockResource name prefix so Jest allows it in the
 * factory scope.
 */
const mockSave = jest.fn();
const mockDestroy = jest.fn();
const mockResource = {
  id: 'cccccccc-0000-0000-0000-000000000003',
  user_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  name: 'Test Folder',
  created_at: '2026-03-21T10:00:00.000Z',
  updated_at: '2026-03-21T10:00:00.000Z',
  save: mockSave,
  destroy: mockDestroy,
};

jest.mock('../../src/middleware/ownershipGuard', () =>
  jest.fn(() =>
    jest.fn((req, res, next) => {
      if (guardBehaviour.mode === 'block') {
        return res.status(404).json({ error: 'Not found' });
      }
      req.resource = mockResource;
      next();
    })
  )
);

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const foldersRouter = require('../../src/routes/folders');
const { Folder } = require('../../src/models');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/folders', foldersRouter);
app.use((err, _req, res, _next) => {
  if (err.message === 'Not implemented') {
    return res.status(501).json({ error: 'Not implemented' });
  }
  res.status(500).json({ error: err.message });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain folder data object (not a Sequelize instance).
 * Used for Folder.findAll results.
 *
 * @param {object} overrides
 */
function makeFolderData(overrides = {}) {
  return {
    id: FOLDER_ID,
    user_id: USER_ID,
    name: 'Test Folder',
    created_at: '2026-03-21T10:00:00.000Z',
    updated_at: '2026-03-21T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Folder routes (TASK-017)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Restore default authenticate behavior
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });

    // Default: ownershipGuard passes
    guardBehaviour.mode = 'pass';

    // Reset save and destroy stubs on the shared mock resource
    mockSave.mockResolvedValue(mockResource);
    mockDestroy.mockResolvedValue(undefined);

    // Default: Folder.scope().findAll returns one folder
    Folder.scope.mockReturnValue(Folder);
    Folder.findAll.mockResolvedValue([makeFolderData()]);
    Folder.create.mockResolvedValue(mockResource);
  });

  // =========================================================================
  // GET /api/folders
  // =========================================================================

  describe('GET /api/folders', () => {
    it('returns 200 with a folders array', async () => {
      const res = await request(app).get('/api/folders');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('folders');
      expect(Array.isArray(res.body.folders)).toBe(true);
    });

    it('returns an empty array when the user has no folders', async () => {
      Folder.findAll.mockResolvedValue([]);

      const res = await request(app).get('/api/folders');

      expect(res.status).toBe(200);
      expect(res.body.folders).toEqual([]);
    });

    it('returns all folders from the query', async () => {
      const folders = [
        makeFolderData({ name: 'Alpha' }),
        makeFolderData({ name: 'Beta', id: 'other-id' }),
      ];
      Folder.findAll.mockResolvedValue(folders);

      const res = await request(app).get('/api/folders');

      expect(res.body.folders).toHaveLength(2);
    });

    it('queries using the forUser scope with the authenticated userId', async () => {
      await request(app).get('/api/folders');

      expect(Folder.scope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
    });

    it('orders results by name ASC', async () => {
      await request(app).get('/api/folders');

      expect(Folder.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ order: [['name', 'ASC']] })
      );
    });

    it('returns 401 when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app).get('/api/folders');

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // POST /api/folders
  // =========================================================================

  describe('POST /api/folders', () => {
    it('returns 201 with the created folder', async () => {
      const res = await request(app)
        .post('/api/folders')
        .send({ name: 'My Folder' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('folder');
    });

    it('calls Folder.create with the session userId and trimmed name', async () => {
      await request(app)
        .post('/api/folders')
        .send({ name: '  My Folder  ' });

      expect(Folder.create).toHaveBeenCalledWith({
        user_id: USER_ID,
        name: 'My Folder',
      });
    });

    it('returns 400 with VALIDATION_ERROR when name is missing', async () => {
      const res = await request(app)
        .post('/api/folders')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with VALIDATION_ERROR when name is empty string', async () => {
      const res = await request(app)
        .post('/api/folders')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with VALIDATION_ERROR when name is whitespace only', async () => {
      const res = await request(app)
        .post('/api/folders')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('does not call Folder.create when name is invalid', async () => {
      await request(app)
        .post('/api/folders')
        .send({ name: '' });

      expect(Folder.create).not.toHaveBeenCalled();
    });

    it('returns 401 when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app)
        .post('/api/folders')
        .send({ name: 'My Folder' });

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // GET /api/folders/:id
  // =========================================================================

  describe('GET /api/folders/:id', () => {
    it('returns 200 with the folder from req.resource', async () => {
      const res = await request(app).get(`/api/folders/${FOLDER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('folder');
    });

    it('returns 404 when ownershipGuard rejects (folder not found or wrong owner)', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app).get(`/api/folders/${FOLDER_ID}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app).get(`/api/folders/${FOLDER_ID}`);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // PUT /api/folders/:id
  // =========================================================================

  describe('PUT /api/folders/:id', () => {
    it('returns 200 with the updated folder', async () => {
      const res = await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({ name: 'Renamed Folder' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('folder');
    });

    it('updates the resource name to the trimmed value', async () => {
      await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({ name: '  Renamed  ' });

      expect(mockResource.name).toBe('Renamed');
    });

    it('calls save() on the resource', async () => {
      await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({ name: 'Renamed Folder' });

      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('returns 400 with VALIDATION_ERROR when name is missing', async () => {
      const res = await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 with VALIDATION_ERROR when name is whitespace only', async () => {
      const res = await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when ownershipGuard rejects (wrong owner)', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(404);
    });

    it('returns 401 when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app)
        .put(`/api/folders/${FOLDER_ID}`)
        .send({ name: 'Renamed' });

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // DELETE /api/folders/:id
  // =========================================================================

  describe('DELETE /api/folders/:id', () => {
    it('returns 204 with no body', async () => {
      const res = await request(app).delete(`/api/folders/${FOLDER_ID}`);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('calls destroy() on the resource', async () => {
      await request(app).delete(`/api/folders/${FOLDER_ID}`);

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when ownershipGuard rejects (wrong owner)', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app).delete(`/api/folders/${FOLDER_ID}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      const res = await request(app).delete(`/api/folders/${FOLDER_ID}`);

      expect(res.status).toBe(401);
    });
  });
});
