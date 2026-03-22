/**
 * Unit tests for GET /api/notes/:id route handler (TASK-008 iter-2).
 *
 * Verifies the route contract:
 *   - Returns 200 with { note: { id, title, body, folder_id, created_at, updated_at } }
 *     when the note is found and owned by the authenticated user
 *   - Returns 401 when the request is unauthenticated
 *   - Returns 404 when the note does not exist or belongs to another user
 *     (ownershipGuard handles this before the handler runs)
 *   - The handler returns req.resource directly (loaded by ownershipGuard)
 *
 * noteService, authenticate, rlsContext, and ownershipGuard are all mocked.
 * No database required.
 *
 * Mocking strategy for ownershipGuard:
 *   ownershipGuard is a factory — it is called at router-require time, before
 *   any beforeEach runs. The returned middleware function is what runs per-request.
 *   We use a module-level mutable `guardBehaviour` object so individual tests
 *   can switch between "pass" and "block" without needing to re-require the router.
 *
 * REQ-008: AC-3 (selecting a note in the sidebar loads it into the editor)
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Mutable guard state — tests flip this between 'pass' and 'block'
// ---------------------------------------------------------------------------

/**
 * Controls ownershipGuard behaviour for the current test.
 *   mode: 'pass'  — attaches guardNote to req.resource and calls next()
 *   mode: 'block' — responds 404 immediately (simulates auth/ownership failure)
 */
const guardBehaviour = { mode: 'pass', note: null };

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

// Mock authenticate: allow all requests through with a test userId by default
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, res, next) => {
    req.session = { userId: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  })
);

// Mock rlsContext: no-op (no DB needed)
jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

/**
 * Mock ownershipGuard factory.
 *
 * The factory is called once at router-require time. The returned middleware
 * reads `guardBehaviour` on every request so individual tests can switch
 * behaviour without re-requiring the router module.
 */
jest.mock('../../src/middleware/rateLimiter', () => ({ rateLimiter: jest.fn((_req, _res, next) => next()) }));
jest.mock('../../src/middleware/ownershipGuard', () =>
  jest.fn(() =>
    jest.fn((req, res, next) => {
      if (guardBehaviour.mode === 'block') {
        return res.status(404).json({ error: 'Not found' });
      }
      req.resource = guardBehaviour.note;
      next();
    })
  )
);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const notesRouter = require('../../src/routes/notes');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';

// ---------------------------------------------------------------------------
// App (built once — the mutable guardBehaviour drives per-test variance)
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
 * Returns a full note object matching the API response shape for GET /api/notes/:id.
 * @param {object} overrides
 */
function makeFullNote(overrides = {}) {
  return {
    id: NOTE_ID,
    title: 'Test Note',
    body: 'Note body content',
    folder_id: null,
    created_at: '2026-03-20T08:00:00.000Z',
    updated_at: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/notes/:id (TASK-008 iter-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset authenticate to pass
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });

    // Reset guard to pass with a default note
    guardBehaviour.mode = 'pass';
    guardBehaviour.note = makeFullNote();
  });

  // -------------------------------------------------------------------------
  // AC-3: Successful note retrieval
  // -------------------------------------------------------------------------

  describe('successful note retrieval', () => {
    it('returns 200 when the note is found and owned by the user', async () => {
      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(200);
    });

    it('returns the note nested under a "note" key', async () => {
      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.body).toHaveProperty('note');
      expect(typeof res.body.note).toBe('object');
    });

    it('returns the full note including body', async () => {
      guardBehaviour.note = makeFullNote({ body: 'Full body text' });

      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.body.note.body).toBe('Full body text');
    });

    it('returns the note that was attached to req.resource by ownershipGuard', async () => {
      guardBehaviour.note = makeFullNote({ title: 'Owned Note', body: 'Content here' });

      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.body.note).toMatchObject({ title: 'Owned Note', body: 'Content here' });
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Ownership enforcement (ownershipGuard returns 404)
  // -------------------------------------------------------------------------

  describe('ownership enforcement', () => {
    it('returns 404 when ownershipGuard blocks the request', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(404);
    });

    it('returns { error: "Not found" } when ownershipGuard blocks', async () => {
      guardBehaviour.mode = 'block';

      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.body).toEqual({ error: 'Not found' });
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

      const res = await request(app).get(`/api/notes/${NOTE_ID}`);

      expect(res.status).toBe(401);
    });
  });
});
