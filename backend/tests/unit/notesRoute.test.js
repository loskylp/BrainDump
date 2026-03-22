/**
 * Unit tests for POST /api/notes route handler (TASK-006).
 *
 * Verifies the route contract:
 *   - Returns 201 with the created note object on success
 *   - Returns { note: { id, title, body, folder_id, created_at, updated_at } }
 *   - Returns 401 when the request is unauthenticated
 *   - Returns 404 when the provided folderId does not exist or is not owned
 *   - Delegates to noteService.createNote with the session userId
 *   - Title defaults to empty string when omitted
 *   - Ownership guard is enforced: unauthenticated requests are rejected
 *
 * noteService is mocked — no database required.
 * authenticate and rlsContext middleware are mocked to isolate route logic.
 *
 * Fitness Functions: FF-D16
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
// Tests that need to test 401 override this mock.
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
const noteService = require('../../src/services/noteService');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Express app mounting the notes router.
 * Used for supertest requests.
 * @returns {express.Application}
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', notesRouter);
  // Generic error handler so unhandled errors produce a 500 instead of crashing
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
 * Returns a plain note object matching the API response shape.
 * @param {object} overrides
 */
function makeNoteResponse(overrides = {}) {
  return {
    id: NOTE_ID,
    user_id: USER_ID,
    title: 'My Note',
    body: '',
    folder_id: null,
    created_at: '2026-03-20T10:00:00.000Z',
    updated_at: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/notes (TASK-006)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default authenticate behavior (authenticated)
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    app = buildApp();
  });

  // -------------------------------------------------------------------------
  // AC-1: Authenticated user can create a note
  // AC-5: Returns created note object with correct fields
  // -------------------------------------------------------------------------

  describe('successful note creation', () => {
    it('returns 201 on successful creation', async () => {
      noteService.createNote.mockResolvedValue(makeNoteResponse());

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(res.status).toBe(201);
    });

    it('returns the note object nested under a "note" key', async () => {
      const note = makeNoteResponse({ title: 'My Note' });
      noteService.createNote.mockResolvedValue(note);

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(res.body).toHaveProperty('note');
    });

    it('response note includes id, title, body, created_at, updated_at', async () => {
      const note = makeNoteResponse({ title: 'My Note' });
      noteService.createNote.mockResolvedValue(note);

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(res.body.note).toMatchObject({
        id: NOTE_ID,
        title: 'My Note',
        body: '',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('delegates to noteService.createNote with the session userId', async () => {
      noteService.createNote.mockResolvedValue(makeNoteResponse());

      await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(noteService.createNote).toHaveBeenCalledWith(
        USER_ID,
        expect.any(Object)
      );
    });

    it('passes the request title to noteService.createNote', async () => {
      noteService.createNote.mockResolvedValue(makeNoteResponse({ title: 'Specific Title' }));

      await request(app)
        .post('/api/notes')
        .send({ title: 'Specific Title' });

      expect(noteService.createNote).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ title: 'Specific Title' })
      );
    });

    it('passes empty string title to service when title is omitted', async () => {
      noteService.createNote.mockResolvedValue(makeNoteResponse({ title: '' }));

      await request(app)
        .post('/api/notes')
        .send({});

      expect(noteService.createNote).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ title: '' })
      );
    });

    it('passes folderId to noteService when provided', async () => {
      const FOLDER_ID = 'ffffffff-0000-0000-0000-000000000002';
      noteService.createNote.mockResolvedValue(makeNoteResponse({ folder_id: FOLDER_ID }));

      await request(app)
        .post('/api/notes')
        .send({ title: 'My Note', folderId: FOLDER_ID });

      expect(noteService.createNote).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ folderId: FOLDER_ID })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-6: Note accessible only to its owner — unauthenticated access rejected
  // -------------------------------------------------------------------------

  describe('authentication enforcement', () => {
    it('returns 401 when the request has no session', async () => {
      // Override authenticate to reject this request
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(res.status).toBe(401);
    });

    it('does not call noteService when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(noteService.createNote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Folder not found — propagated as 404
  // -------------------------------------------------------------------------

  describe('folder not found handling', () => {
    it('returns 404 when service throws FOLDER_NOT_FOUND', async () => {
      noteService.createNote.mockRejectedValue(new Error('FOLDER_NOT_FOUND'));

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note', folderId: 'nonexistent-folder-id' });

      expect(res.status).toBe(404);
    });

    it('returns an error message when folder is not found', async () => {
      noteService.createNote.mockRejectedValue(new Error('FOLDER_NOT_FOUND'));

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note', folderId: 'nonexistent-folder-id' });

      expect(res.body).toHaveProperty('error');
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('calls next(err) on unexpected service errors', async () => {
      noteService.createNote.mockRejectedValue(new Error('Unexpected DB error'));

      const res = await request(app)
        .post('/api/notes')
        .send({ title: 'My Note' });

      expect(res.status).toBe(500);
    });
  });
});
