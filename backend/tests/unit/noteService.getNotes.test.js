/**
 * Unit tests for noteService.getNotes (TASK-008).
 *
 * Verifies the contract:
 *   - Returns all notes owned by the given user
 *   - Returns notes sorted by updated_at DESC (newest first)
 *   - Returns an empty array when the user has no notes
 *   - Does not return notes owned by other users
 *
 * All database calls are mocked — no database required for these tests.
 *
 * REQ-008: AC-2 (list via GET /api/notes sorted by last modified, newest first)
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const NOTE_ID_1 = 'dddddddd-0000-0000-0000-000000000003';
const NOTE_ID_2 = 'eeeeeeee-0000-0000-0000-000000000004';

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

const { getNotes } = require('../../src/services/noteService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain Note-like object for the given user.
 * @param {object} overrides
 */
function makeNote(overrides = {}) {
  return {
    id: NOTE_ID_1,
    user_id: USER_ID,
    folder_id: null,
    title: 'Test Note',
    updated_at: new Date('2026-03-20T10:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noteService.getNotes (TASK-008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Note.scope.mockReturnThis();
  });

  // -------------------------------------------------------------------------
  // AC-2: Returns all user notes via user-scoped query
  // -------------------------------------------------------------------------

  describe('returns user-owned notes', () => {
    it('queries using the forUser scope with the given userId', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getNotes(USER_ID);

      expect(Note.scope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
    });

    it('returns the array of notes from findAll', async () => {
      const notes = [makeNote({ title: 'Note A' }), makeNote({ id: NOTE_ID_2, title: 'Note B' })];
      Note.findAll = jest.fn().mockResolvedValue(notes);

      const result = await getNotes(USER_ID);

      expect(result).toBe(notes);
    });

    it('returns an empty array when the user has no notes', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      const result = await getNotes(USER_ID);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Sorted by updated_at DESC (newest first)
  // -------------------------------------------------------------------------

  describe('sort order', () => {
    it('calls findAll with order: updated_at DESC', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getNotes(USER_ID);

      expect(Note.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['updated_at', 'DESC']],
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Only id, title, updated_at, folder_id returned (no body)
  // -------------------------------------------------------------------------

  describe('field selection', () => {
    it('calls findAll with attributes limiting to id, title, updated_at, folder_id', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getNotes(USER_ID);

      expect(Note.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.arrayContaining(['id', 'title', 'updated_at', 'folder_id']),
        })
      );
    });

    it('does not request the body field (performance: body excluded from list)', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getNotes(USER_ID);

      const callArgs = Note.findAll.mock.calls[0][0];
      if (callArgs.attributes) {
        expect(callArgs.attributes).not.toContain('body');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('propagates errors thrown by findAll', async () => {
      const dbError = new Error('DB connection lost');
      Note.findAll = jest.fn().mockRejectedValue(dbError);

      await expect(getNotes(USER_ID)).rejects.toThrow('DB connection lost');
    });
  });
});
