/**
 * Unit tests for GET /api/notes route handler (TASK-008).
 *
 * Verifies the route contract:
 *   - Returns 200 with { notes: [...] } on success
 *   - Returns 401 when the request is unauthenticated
 *   - Returns empty array when user has no notes
 *   - Delegates to tagService.getNotesWithTags with the session userId
 *   - Passes null tagIds when no ?tags= query param is given
 *   - Passes parsed tag ID array when ?tags=id1,id2 is given
 *
 * tagService and noteService are mocked — no database required.
 * authenticate and rlsContext middleware are mocked to isolate route logic.
 *
 * REQ-008: AC-2 (sidebar lists all user notes via GET /api/notes)
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Mock noteService before importing the router
// ---------------------------------------------------------------------------

jest.mock('../../src/services/noteService', () => ({
  createNote: jest.fn(),
  getNotes: jest.fn(),
  getNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
}));

jest.mock('../../src/services/tagService', () => ({
  getNotesWithTags: jest.fn(),
  createTag: jest.fn(),
  deleteTag: jest.fn(),
  addTagToNote: jest.fn(),
  removeTagFromNote: jest.fn(),
}));

// Mock authenticate: by default, allow all requests through with a test userId.
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, res, next) => {
    req.session = { userId: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  })
);

// Mock rlsContext: no-op (no DB needed)
jest.mock('../../src/middleware/rateLimiter', () => ({ rateLimiter: jest.fn((_req, _res, next) => next()) }));
jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const notesRouter = require('../../src/routes/notes');
const tagService = require('../../src/services/tagService');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOTE_ID_1 = 'dddddddd-0000-0000-0000-000000000003';
const NOTE_ID_2 = 'eeeeeeee-0000-0000-0000-000000000004';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Express app mounting the notes router.
 * @returns {express.Application}
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', notesRouter);
  app.use((err, _req, res, _next) => {
    if (err.message === 'Not implemented') {
      return res.status(501).json({ error: 'Not implemented' });
    }
    res.status(500).json({ error: err.message });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain note list item matching the API response shape.
 * Body is excluded — list responses only return summary fields.
 * @param {object} overrides
 */
function makeNoteSummary(overrides = {}) {
  return {
    id: NOTE_ID_1,
    title: 'Test Note',
    updated_at: '2026-03-20T10:00:00.000Z',
    folder_id: null,
    tags: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/notes (TASK-008)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    app = buildApp();
  });

  // -------------------------------------------------------------------------
  // AC-2: Returns all user notes
  // -------------------------------------------------------------------------

  describe('successful note listing', () => {
    it('returns 200 on successful retrieval', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      const res = await request(app).get('/api/notes');

      expect(res.status).toBe(200);
    });

    it('returns the notes array nested under a "notes" key', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      const res = await request(app).get('/api/notes');

      expect(res.body).toHaveProperty('notes');
      expect(Array.isArray(res.body.notes)).toBe(true);
    });

    it('returns an empty array when the user has no notes', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      const res = await request(app).get('/api/notes');

      expect(res.body.notes).toEqual([]);
    });

    it('returns the notes from tagService in the response', async () => {
      const notes = [
        makeNoteSummary({ id: NOTE_ID_1, title: 'Note A' }),
        makeNoteSummary({ id: NOTE_ID_2, title: 'Note B' }),
      ];
      tagService.getNotesWithTags.mockResolvedValue(notes);

      const res = await request(app).get('/api/notes');

      expect(res.body.notes).toEqual(notes);
    });

    it('delegates to tagService.getNotesWithTags with the session userId', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      await request(app).get('/api/notes');

      expect(tagService.getNotesWithTags).toHaveBeenCalledWith(USER_ID, null);
    });

    it('calls tagService.getNotesWithTags exactly once per request', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      await request(app).get('/api/notes');

      expect(tagService.getNotesWithTags).toHaveBeenCalledTimes(1);
    });

    it('passes null tagIds when no ?tags= query param is given', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      await request(app).get('/api/notes');

      expect(tagService.getNotesWithTags).toHaveBeenCalledWith(USER_ID, null);
    });

    it('passes parsed tag ID array when ?tags=tag-id-1 is given', async () => {
      tagService.getNotesWithTags.mockResolvedValue([]);

      await request(app).get('/api/notes?tags=tag-id-1');

      expect(tagService.getNotesWithTags).toHaveBeenCalledWith(USER_ID, ['tag-id-1']);
    });
  });

  // -------------------------------------------------------------------------
  // Authentication enforcement
  // -------------------------------------------------------------------------

  describe('authentication enforcement', () => {
    it('returns 401 when the request has no session', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      const res = await request(app).get('/api/notes');

      expect(res.status).toBe(401);
    });

    it('does not call tagService when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      await request(app).get('/api/notes');

      expect(tagService.getNotesWithTags).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('calls next(err) on unexpected service errors', async () => {
      tagService.getNotesWithTags.mockRejectedValue(new Error('Unexpected DB error'));

      const res = await request(app).get('/api/notes');

      expect(res.status).toBe(500);
    });
  });
});
