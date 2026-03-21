/**
 * Unit tests for version routes (TASK-013).
 *
 * Verifies route contracts:
 *   - POST /api/notes/:id/check-version
 *   - GET /api/notes/:id/versions
 *   - GET /api/notes/:id/versions/:versionId
 *   - POST /api/notes/:id/versions/restore/:versionId
 *
 * versionService is mocked -- no database required.
 */

'use strict';

const request = require('supertest');
const express = require('express');

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';
const VERSION_ID = 'vvvvvvvv-0000-0000-0000-000000000001';

const guardBehaviour = { mode: 'pass' };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../src/services/versionService', () => ({
  checkAndCreateVersion: jest.fn(),
  getVersions: jest.fn(),
  getVersion: jest.fn(),
  restoreVersion: jest.fn(),
}));

jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, _res, next) => {
    req.session = { userId: USER_ID };
    next();
  })
);

jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

jest.mock('../../src/middleware/ownershipGuard', () =>
  jest.fn(() =>
    jest.fn((req, res, next) => {
      if (guardBehaviour.mode === 'block') {
        return res.status(404).json({ error: 'Not found' });
      }
      req.resource = { id: NOTE_ID, user_id: USER_ID };
      next();
    })
  )
);

const versionsRouter = require('../../src/routes/versions');
const versionService = require('../../src/services/versionService');
const authenticate = require('../../src/middleware/authenticate');

const app = express();
app.use(express.json());
app.use(`/api/notes/:id`, versionsRouter);
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Version routes (TASK-013)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    guardBehaviour.mode = 'pass';
  });

  // -------------------------------------------------------------------------
  // POST /api/notes/:id/check-version
  // -------------------------------------------------------------------------

  describe('POST /api/notes/:id/check-version', () => {
    it('returns 200 with versionCreated=true when version is created', async () => {
      versionService.checkAndCreateVersion.mockResolvedValue({
        created: true,
        version: { version_number: 2 },
      });

      const res = await request(app)
        .post(`/api/notes/${NOTE_ID}/check-version`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        versionCreated: true,
        versionNumber: 2,
      });
    });

    it('returns 200 with versionCreated=false when no change detected', async () => {
      versionService.checkAndCreateVersion.mockResolvedValue({
        created: false,
        version: null,
      });

      const res = await request(app)
        .post(`/api/notes/${NOTE_ID}/check-version`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        versionCreated: false,
        versionNumber: null,
      });
    });

    it('returns 404 when note not found', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app)
        .post(`/api/notes/${NOTE_ID}/check-version`);

      expect(res.status).toBe(404);
    });

    it('delegates to versionService with correct params', async () => {
      versionService.checkAndCreateVersion.mockResolvedValue({
        created: false,
        version: null,
      });

      await request(app).post(`/api/notes/${NOTE_ID}/check-version`);

      expect(versionService.checkAndCreateVersion).toHaveBeenCalledWith(
        NOTE_ID,
        USER_ID
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/notes/:id/versions
  // -------------------------------------------------------------------------

  describe('GET /api/notes/:id/versions', () => {
    it('returns 200 with versions array', async () => {
      const versions = [
        { id: 'v2', version_number: 2, created_at: '2026-03-20T12:00:00.000Z' },
        { id: 'v1', version_number: 1, created_at: '2026-03-20T10:00:00.000Z' },
      ];
      versionService.getVersions.mockResolvedValue(versions);

      const res = await request(app)
        .get(`/api/notes/${NOTE_ID}/versions`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ versions });
    });

    it('returns 404 when note not found', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app)
        .get(`/api/notes/${NOTE_ID}/versions`);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/notes/:id/versions/:versionId
  // -------------------------------------------------------------------------

  describe('GET /api/notes/:id/versions/:versionId', () => {
    it('returns 200 with version content', async () => {
      const version = {
        id: VERSION_ID,
        version_number: 1,
        title: 'Title v1',
        body: 'Body v1',
        created_at: '2026-03-20T10:00:00.000Z',
      };
      versionService.getVersion.mockResolvedValue(version);

      const res = await request(app)
        .get(`/api/notes/${NOTE_ID}/versions/${VERSION_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ version });
    });

    it('returns 400 on VERSION_MISMATCH', async () => {
      versionService.getVersion.mockRejectedValue(new Error('VERSION_MISMATCH'));

      const res = await request(app)
        .get(`/api/notes/${NOTE_ID}/versions/${VERSION_ID}`);

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/notes/:id/versions/restore/:versionId
  // -------------------------------------------------------------------------

  describe('POST /api/notes/:id/versions/restore/:versionId', () => {
    it('returns 200 with restored note and new version number', async () => {
      versionService.restoreVersion.mockResolvedValue({
        note: {
          id: NOTE_ID,
          title: 'Restored Title',
          body: 'Restored body',
          updated_at: '2026-03-20T14:00:00.000Z',
        },
        newVersion: { version_number: 3 },
      });

      const res = await request(app)
        .post(`/api/notes/${NOTE_ID}/restore/${VERSION_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        note: {
          id: NOTE_ID,
          title: 'Restored Title',
          body: 'Restored body',
          updated_at: '2026-03-20T14:00:00.000Z',
        },
        newVersionNumber: 3,
      });
    });

    it('returns 404 when note not found', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app)
        .post(`/api/notes/${NOTE_ID}/restore/${VERSION_ID}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 on VERSION_MISMATCH', async () => {
      versionService.restoreVersion.mockRejectedValue(new Error('VERSION_MISMATCH'));

      const res = await request(app)
        .post(`/api/notes/${NOTE_ID}/restore/${VERSION_ID}`);

      expect(res.status).toBe(400);
    });

    it('delegates to versionService with correct params', async () => {
      versionService.restoreVersion.mockResolvedValue({
        note: { id: NOTE_ID, title: 'T', body: 'B', updated_at: '2026-03-20T14:00:00.000Z' },
        newVersion: { version_number: 3 },
      });

      await request(app)
        .post(`/api/notes/${NOTE_ID}/restore/${VERSION_ID}`);

      expect(versionService.restoreVersion).toHaveBeenCalledWith(
        NOTE_ID,
        VERSION_ID,
        USER_ID
      );
    });
  });
});
