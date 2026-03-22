/**
 * Unit tests for DELETE /api/notes/:id route handler (TASK-010).
 *
 * Verifies the route contract:
 *   - Returns 204 with no body on successful deletion
 *   - Returns 401 when the request is unauthenticated
 *   - Returns 404 when ownershipGuard rejects (note not found or wrong owner)
 *   - Delegates to noteService.deleteNote with session userId and note id
 *   - Propagates unexpected service errors as 500
 *
 * noteService is mocked -- no database required.
 * authenticate, rlsContext, and ownershipGuard middleware are mocked to isolate
 * route logic.
 *
 * REQ-006 (Delete a note), ADR-006 (ownership guard)
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';

// ---------------------------------------------------------------------------
// Mutable guard state
// ---------------------------------------------------------------------------

const guardBehaviour = { mode: 'pass' };

// ---------------------------------------------------------------------------
// Mocks
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

jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, _res, next) => {
    req.session = { userId: USER_ID };
    next();
  })
);

jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

jest.mock('../../src/middleware/rateLimiter', () => jest.fn((_req, _res, next) => next()));
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

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const notesRouter = require('../../src/routes/notes');
const noteService = require('../../src/services/noteService');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/notes', notesRouter);
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/notes/:id (TASK-010)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    guardBehaviour.mode = 'pass';
  });

  // -------------------------------------------------------------------------
  // AC-1: Successful deletion returns 204
  // -------------------------------------------------------------------------

  describe('successful deletion', () => {
    it('returns 204 on successful delete', async () => {
      noteService.deleteNote.mockResolvedValue(undefined);

      const res = await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(204);
    });

    it('returns no body on successful delete', async () => {
      noteService.deleteNote.mockResolvedValue(undefined);

      const res = await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(res.text).toBe('');
    });

    it('delegates to noteService.deleteNote with the correct arguments', async () => {
      noteService.deleteNote.mockResolvedValue(undefined);

      await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(noteService.deleteNote).toHaveBeenCalledWith(NOTE_ID, USER_ID);
    });

    it('does not call other noteService methods', async () => {
      noteService.deleteNote.mockResolvedValue(undefined);

      await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(noteService.createNote).not.toHaveBeenCalled();
      expect(noteService.updateNote).not.toHaveBeenCalled();
      expect(noteService.getNotes).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Ownership enforcement
  // -------------------------------------------------------------------------

  describe('ownership enforcement', () => {
    it('returns 404 when ownershipGuard rejects the request', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(404);
    });

    it('does not call noteService.deleteNote when ownershipGuard rejects', async () => {
      guardBehaviour.mode = 'block';

      await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(noteService.deleteNote).not.toHaveBeenCalled();
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

      const res = await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(401);
    });

    it('does not call noteService when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(noteService.deleteNote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('returns 500 on unexpected service errors', async () => {
      noteService.deleteNote.mockRejectedValue(new Error('Unexpected DB error'));

      const res = await request(app).delete(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(500);
    });
  });
});
