/**
 * Unit tests for noteService.getNote (TASK-008 iter-2).
 *
 * Verifies the contract:
 *   - Returns the full note (including body) when the note exists and belongs to the user
 *   - Uses the forUser scope to enforce ownership at the query level
 *   - Returns null (caller maps to NOT_FOUND error) when note does not exist
 *   - Returns null when the note belongs to a different user
 *   - Propagates unexpected database errors
 *
 * All database calls are mocked — no database required.
 *
 * REQ-008: AC-3 (selecting a note in the sidebar loads it into the editor)
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

jest.mock('../../src/models', () => {
  const Note = {
    scope: jest.fn().mockReturnThis(),
    findAll: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const NoteVersion = {
    create: jest.fn(),
  };

  const Folder = {
    scope: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
  };

  const sequelize = {
    transaction: jest.fn(async (callback) => callback({})),
    query: jest.fn().mockResolvedValue(null),
  };

  return { Note, NoteVersion, Folder, sequelize };
});

const { Note } = require('../../src/models');

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are set up
// ---------------------------------------------------------------------------

const { getNote } = require('../../src/services/noteService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain Note-like object including body, owned by USER_ID.
 * @param {object} overrides
 */
function makeFullNote(overrides = {}) {
  return {
    id: NOTE_ID,
    user_id: USER_ID,
    folder_id: null,
    title: 'Test Note',
    body: 'Note body content',
    created_at: new Date('2026-03-20T08:00:00Z'),
    updated_at: new Date('2026-03-20T10:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noteService.getNote (TASK-008 iter-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Note.scope.mockReturnThis();
  });

  // -------------------------------------------------------------------------
  // AC-3: Returns the full note when found and owned by the user
  // -------------------------------------------------------------------------

  describe('successful retrieval', () => {
    it('queries using the forUser scope with the given userId', async () => {
      Note.findOne = jest.fn().mockResolvedValue(makeFullNote());

      await getNote(NOTE_ID, USER_ID);

      expect(Note.scope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
    });

    it('queries by the given noteId', async () => {
      Note.findOne = jest.fn().mockResolvedValue(makeFullNote());

      await getNote(NOTE_ID, USER_ID);

      expect(Note.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: NOTE_ID }),
        })
      );
    });

    it('returns the note instance returned by findOne', async () => {
      const note = makeFullNote({ title: 'My Note', body: 'Hello world' });
      Note.findOne = jest.fn().mockResolvedValue(note);

      const result = await getNote(NOTE_ID, USER_ID);

      expect(result).toBe(note);
    });

    it('returns a note that includes the body field', async () => {
      const note = makeFullNote({ body: 'Full body content here' });
      Note.findOne = jest.fn().mockResolvedValue(note);

      const result = await getNote(NOTE_ID, USER_ID);

      expect(result.body).toBe('Full body content here');
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Ownership enforcement — note not found or belongs to another user
  // -------------------------------------------------------------------------

  describe('not found handling', () => {
    it('throws an error with message NOT_FOUND when findOne returns null', async () => {
      Note.findOne = jest.fn().mockResolvedValue(null);

      await expect(getNote(NOTE_ID, USER_ID)).rejects.toThrow('NOT_FOUND');
    });

    it('does not throw when the note exists and belongs to the user', async () => {
      Note.findOne = jest.fn().mockResolvedValue(makeFullNote());

      await expect(getNote(NOTE_ID, USER_ID)).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('propagates unexpected errors thrown by findOne', async () => {
      const dbError = new Error('DB connection lost');
      Note.findOne = jest.fn().mockRejectedValue(dbError);

      await expect(getNote(NOTE_ID, USER_ID)).rejects.toThrow('DB connection lost');
    });
  });
});
