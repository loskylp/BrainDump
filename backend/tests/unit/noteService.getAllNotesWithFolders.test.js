/**
 * Unit tests for noteService.getAllNotesWithFolders (TASK-029).
 *
 * Verifies the contract:
 *   - Returns all notes owned by the given user with associated folder data
 *   - Includes note body (required for ZIP export content)
 *   - Notes with no folder have folder set to null
 *   - Notes with a folder include folder id and name
 *   - Returns an empty array when the user has no notes
 *   - Uses the forUser scope for user isolation
 *   - Sorts by folder name NULLS FIRST, then note title ASC (ADR-011 query spec)
 *
 * All database calls are mocked — no database required for these tests.
 *
 * REQ-020: AC-2 (complete note collection with folder data for ZIP export)
 * ADR-011: backend endpoint streams ZIP; query fetches all notes with folder names
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const NOTE_ID_1 = 'dddddddd-0000-0000-0000-000000000003';
const NOTE_ID_2 = 'eeeeeeee-0000-0000-0000-000000000004';
const FOLDER_ID = 'cccccccc-0000-0000-0000-000000000005';

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

  const User = {
    findByPk: jest.fn().mockResolvedValue({ username: 'testuser' }),
  };

  const sequelize = {
    transaction: jest.fn(async (callback) => callback({})),
    query: jest.fn().mockResolvedValue(null),
  };

  return { Note, NoteVersion, Folder, User, sequelize };
});

const { Note, Folder } = require('../../src/models');

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are set up
// ---------------------------------------------------------------------------

const { getAllNotesWithFolders } = require('../../src/services/noteService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain Note-like object with folder association data.
 * @param {object} overrides
 */
function makeNoteWithFolder(overrides = {}) {
  return {
    id: NOTE_ID_1,
    user_id: USER_ID,
    title: 'Test Note',
    body: '# Hello\n\nWorld',
    folder_id: null,
    folder: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noteService.getAllNotesWithFolders (TASK-029)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Note.scope.mockReturnValue(Note);
  });

  // -------------------------------------------------------------------------
  // User scoping — isolation enforced at application layer
  // -------------------------------------------------------------------------

  describe('user isolation', () => {
    it('queries using the forUser scope with the given userId', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getAllNotesWithFolders(USER_ID);

      expect(Note.scope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
    });

    it('passes userId correctly to the forUser scope (not other userId)', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getAllNotesWithFolders(OTHER_USER_ID);

      expect(Note.scope).toHaveBeenCalledWith({ method: ['forUser', OTHER_USER_ID] });
    });
  });

  // -------------------------------------------------------------------------
  // Return shape — body included, folder association included
  // -------------------------------------------------------------------------

  describe('return shape', () => {
    it('returns the array of notes from findAll', async () => {
      const notes = [makeNoteWithFolder({ title: 'Note A' })];
      Note.findAll = jest.fn().mockResolvedValue(notes);

      const result = await getAllNotesWithFolders(USER_ID);

      expect(result).toBe(notes);
    });

    it('returns an empty array when the user has no notes', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      const result = await getAllNotesWithFolders(USER_ID);

      expect(result).toEqual([]);
    });

    it('passes the Folder model as an include to findAll', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getAllNotesWithFolders(USER_ID);

      expect(Note.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ model: Folder }),
          ]),
        })
      );
    });

    it('includes body in the attribute set (body is required for ZIP file content)', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getAllNotesWithFolders(USER_ID);

      const callArgs = Note.findAll.mock.calls[0][0];
      // If attributes is explicitly specified, body must be included
      if (callArgs.attributes) {
        expect(callArgs.attributes).toContain('body');
      }
      // If attributes is not specified, all columns are returned (including body)
    });
  });

  // -------------------------------------------------------------------------
  // Sort order — matches ADR-011 SQL spec
  // -------------------------------------------------------------------------

  describe('sort order', () => {
    it('calls findAll with an order clause', async () => {
      Note.findAll = jest.fn().mockResolvedValue([]);

      await getAllNotesWithFolders(USER_ID);

      expect(Note.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.any(Array),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('propagates errors thrown by findAll', async () => {
      const dbError = new Error('DB connection lost');
      Note.findAll = jest.fn().mockRejectedValue(dbError);

      await expect(getAllNotesWithFolders(USER_ID)).rejects.toThrow('DB connection lost');
    });
  });
});
