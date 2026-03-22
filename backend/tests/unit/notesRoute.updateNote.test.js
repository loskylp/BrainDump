/**
 * Unit tests for PUT /api/notes/:id route handler (TASK-009).
 *
 * Verifies the route contract:
 *   - Returns 200 with { note: { id, title, body, updated_at } } on success
 *   - Returns 401 when the request is unauthenticated
 *   - Returns 404 when ownershipGuard rejects (note not found or wrong owner)
 *   - Delegates to noteService.updateNote with session userId and the request body
 *   - Passes title, body, and folderId from the request body to the service
 *   - Propagates unexpected service errors as 500
 *
 * noteService is mocked — no database required.
 * authenticate, rlsContext, and ownershipGuard middleware are mocked to isolate
 * route logic.
 *
 * Mocking strategy for ownershipGuard:
 *   ownershipGuard is a factory called once at router-require time. A mutable
 *   `guardBehaviour` object lets individual tests flip between pass/block without
 *   re-requiring the router, following the pattern from notesRoute.getNote.test.js.
 *
 * REQ-005 (Edit a note), ADR-006 (ownership guard)
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
// Mutable guard state — tests flip this between 'pass' and 'block'
// ---------------------------------------------------------------------------

/**
 * Controls ownershipGuard behaviour for the current test.
 *   mode: 'pass'  — attaches a stub resource to req.resource and calls next()
 *   mode: 'block' — responds 404 immediately (simulates auth/ownership failure)
 */
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

// Authenticate: allow all requests through with a test userId by default
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, _res, next) => {
    req.session = { userId: USER_ID };
    next();
  })
);

// rlsContext: no-op
jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

/**
 * Mock ownershipGuard factory.
 *
 * The factory is called once at router-require time. The returned middleware
 * reads guardBehaviour on every request so individual tests can switch
 * behaviour without re-requiring the router module.
 */
jest.mock('../../src/middleware/rateLimiter', () => ({ rateLimiter: jest.fn((_req, _res, next) => next()) }));
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
// App (built once — guardBehaviour and authenticate mock drive per-test variance)
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/notes', notesRouter);
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
 * Returns an updated note response object matching the API contract.
 * @param {object} overrides
 */
function makeUpdatedNote(overrides = {}) {
  return {
    id: NOTE_ID,
    user_id: USER_ID,
    title: 'Updated Title',
    body: 'Updated body',
    folder_id: null,
    created_at: '2026-03-20T08:00:00.000Z',
    updated_at: '2026-03-20T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PUT /api/notes/:id (TASK-009)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Restore default authenticate behavior (pass)
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });

    // Reset guard to pass
    guardBehaviour.mode = 'pass';
  });

  // -------------------------------------------------------------------------
  // AC-1 + AC-2: Successful update — returns 200 with updated note
  // -------------------------------------------------------------------------

  describe('successful update', () => {
    it('returns 200 on successful update', async () => {
      noteService.updateNote.mockResolvedValue(makeUpdatedNote());

      const res = await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Updated Title', body: 'Updated body' });

      expect(res.status).toBe(200);
    });

    it('returns the note object nested under a "note" key', async () => {
      noteService.updateNote.mockResolvedValue(makeUpdatedNote());

      const res = await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Updated Title' });

      expect(res.body).toHaveProperty('note');
    });

    it('response note includes id, title, body, and updated_at', async () => {
      const updatedNote = makeUpdatedNote({ title: 'New Title', body: 'New body' });
      noteService.updateNote.mockResolvedValue(updatedNote);

      const res = await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'New Title', body: 'New body' });

      expect(res.body.note).toMatchObject({
        id: NOTE_ID,
        title: 'New Title',
        body: 'New body',
        updated_at: expect.any(String),
      });
    });

    it('delegates to noteService.updateNote with the session userId', async () => {
      noteService.updateNote.mockResolvedValue(makeUpdatedNote());

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'T' });

      expect(noteService.updateNote).toHaveBeenCalledWith(
        NOTE_ID,
        USER_ID,
        expect.any(Object)
      );
    });

    it('passes title from request body to the service', async () => {
      noteService.updateNote.mockResolvedValue(makeUpdatedNote({ title: 'Specific Title' }));

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Specific Title' });

      expect(noteService.updateNote).toHaveBeenCalledWith(
        NOTE_ID,
        USER_ID,
        expect.objectContaining({ title: 'Specific Title' })
      );
    });

    it('passes body from request body to the service', async () => {
      noteService.updateNote.mockResolvedValue(makeUpdatedNote({ body: 'The body content' }));

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ body: 'The body content' });

      expect(noteService.updateNote).toHaveBeenCalledWith(
        NOTE_ID,
        USER_ID,
        expect.objectContaining({ body: 'The body content' })
      );
    });

    it('passes folderId from request body to the service', async () => {
      const FOLDER_ID = 'ffffffff-0000-0000-0000-000000000002';
      noteService.updateNote.mockResolvedValue(makeUpdatedNote({ folder_id: FOLDER_ID }));

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ folderId: FOLDER_ID });

      expect(noteService.updateNote).toHaveBeenCalledWith(
        NOTE_ID,
        USER_ID,
        expect.objectContaining({ folderId: FOLDER_ID })
      );
    });

    it('does not call noteService.createNote or getNotes', async () => {
      noteService.updateNote.mockResolvedValue(makeUpdatedNote());

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'T' });

      expect(noteService.createNote).not.toHaveBeenCalled();
      expect(noteService.getNotes).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Cross-user access returns 404 (ownershipGuard)
  // -------------------------------------------------------------------------

  describe('ownership enforcement', () => {
    it('returns 404 when ownershipGuard rejects the request', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Hack' });

      expect(res.status).toBe(404);
    });

    it('does not call noteService.updateNote when ownershipGuard rejects', async () => {
      guardBehaviour.mode = 'block';

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'Hack' });

      expect(noteService.updateNote).not.toHaveBeenCalled();
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

      const res = await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'T' });

      expect(res.status).toBe(401);
    });

    it('does not call noteService when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'T' });

      expect(noteService.updateNote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('calls next(err) on unexpected service errors, producing 500', async () => {
      noteService.updateNote.mockRejectedValue(new Error('Unexpected DB error'));

      const res = await request(app)
        .put(`/api/notes/${NOTE_ID}`)
        .send({ title: 'T' });

      expect(res.status).toBe(500);
    });
  });
});
