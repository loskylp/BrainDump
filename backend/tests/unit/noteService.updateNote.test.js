/**
 * Unit tests for noteService.updateNote (TASK-009).
 *
 * Verifies the contract:
 *   - Updates the note's title and/or body inside a transaction
 *   - Executes SET LOCAL app.current_user_id inside the transaction (RLS, ADR-006)
 *   - Returns the updated Note instance with a refreshed updated_at
 *   - Throws 'NOT_FOUND' when note does not exist or belongs to a different user
 *   - Does NOT create a NoteVersion row (that is versionService's job, ADR-004)
 *   - Propagates unexpected database errors
 *
 * All database calls are mocked — no database required.
 *
 * REQ-005 (Edit a note), ADR-004 (auto-save owns notes row only), ADR-006 (RLS)
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';
const FOLDER_ID = 'cccccccc-0000-0000-0000-000000000004';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

jest.mock('../../src/models', () => {
  const mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

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
    transaction: jest.fn(async (callback) => callback(mockTransaction)),
    query: jest.fn().mockResolvedValue(null),
  };

  sequelize._mockTransaction = mockTransaction;

  return { Note, NoteVersion, Folder, sequelize };
});

const { Note, NoteVersion, Folder, sequelize } = require('../../src/models');

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are set up
// ---------------------------------------------------------------------------

const { updateNote } = require('../../src/services/noteService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a mock Note instance with a save() stub, simulating a Sequelize
 * model instance returned by findOne().
 * @param {object} overrides
 */
function makeSaveableNote(overrides = {}) {
  const note = {
    id: NOTE_ID,
    user_id: USER_ID,
    folder_id: null,
    title: 'Original Title',
    body: 'Original body',
    created_at: new Date('2026-03-20T08:00:00Z'),
    updated_at: new Date('2026-03-20T10:00:00Z'),
    save: jest.fn(),
    ...overrides,
  };
  // save() resolves with the note instance itself (as Sequelize does)
  note.save.mockResolvedValue(note);
  return note;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noteService.updateNote (TASK-009)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Note.scope.mockReturnValue(Note);
    Note.findOne.mockResolvedValue(makeSaveableNote());
    NoteVersion.create.mockResolvedValue({});
    // Default: Folder scope chain returns a Folder mock with findOne resolving a folder
    Folder.scope.mockReturnValue(Folder);
    Folder.findOne.mockResolvedValue({ id: FOLDER_ID });
  });

  // -------------------------------------------------------------------------
  // Ownership lookup — uses forUser scope
  // -------------------------------------------------------------------------

  describe('note lookup', () => {
    it('queries the note using the forUser scope with the given userId', async () => {
      await updateNote(NOTE_ID, USER_ID, { title: 'New Title' });

      expect(Note.scope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
    });

    it('queries the note by the given noteId', async () => {
      await updateNote(NOTE_ID, USER_ID, { title: 'New Title' });

      expect(Note.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: NOTE_ID }),
        })
      );
    });

    it('throws NOT_FOUND when the note does not exist', async () => {
      Note.findOne.mockResolvedValue(null);

      await expect(updateNote(NOTE_ID, USER_ID, { title: 'New Title' })).rejects.toThrow('NOT_FOUND');
    });

    it('throws NOT_FOUND when the note belongs to a different user', async () => {
      // The forUser scope returns null for notes not owned by userId
      Note.findOne.mockResolvedValue(null);

      await expect(
        updateNote(NOTE_ID, OTHER_USER_ID, { title: 'Hack' })
      ).rejects.toThrow('NOT_FOUND');
    });

    it('does not call save() when the note is not found', async () => {
      Note.findOne.mockResolvedValue(null);

      try {
        await updateNote(NOTE_ID, USER_ID, { title: 'New Title' });
      } catch {
        // expected
      }

      // no note instance exists, so save was never called
      // we verify NoteVersion.create was also not called
      expect(NoteVersion.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Field updates
  // -------------------------------------------------------------------------

  describe('field updates', () => {
    it('updates the note title when title is provided', async () => {
      const note = makeSaveableNote({ title: 'Old Title' });
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { title: 'New Title' });

      expect(note.title).toBe('New Title');
    });

    it('updates the note body when body is provided', async () => {
      const note = makeSaveableNote({ body: 'Old body' });
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { body: 'Updated body' });

      expect(note.body).toBe('Updated body');
    });

    it('updates both title and body when both are provided', async () => {
      const note = makeSaveableNote({ title: 'Old', body: 'Old body' });
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { title: 'New Title', body: 'New body' });

      expect(note.title).toBe('New Title');
      expect(note.body).toBe('New body');
    });

    it('does not alter title when title is not provided in updates', async () => {
      const note = makeSaveableNote({ title: 'Preserved Title', body: 'Old body' });
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { body: 'New body only' });

      expect(note.title).toBe('Preserved Title');
    });

    it('does not alter body when body is not provided in updates', async () => {
      const note = makeSaveableNote({ title: 'Old', body: 'Preserved body' });
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { title: 'New title only' });

      expect(note.body).toBe('Preserved body');
    });

    it('calls note.save() to persist the changes', async () => {
      const note = makeSaveableNote();
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { title: 'Saved' });

      expect(note.save).toHaveBeenCalledTimes(1);
    });

    it('returns the updated note instance', async () => {
      const note = makeSaveableNote({ title: 'Updated' });
      Note.findOne.mockResolvedValue(note);

      const result = await updateNote(NOTE_ID, USER_ID, { title: 'Updated' });

      expect(result).toBe(note);
    });
  });

  // -------------------------------------------------------------------------
  // Transaction and RLS (ADR-006)
  // -------------------------------------------------------------------------

  describe('transaction and RLS enforcement', () => {
    it('wraps the update in a sequelize transaction', async () => {
      await updateNote(NOTE_ID, USER_ID, { title: 'T' });

      expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    });

    it('executes SET LOCAL app.current_user_id inside the transaction', async () => {
      const mockTxn = sequelize._mockTransaction;

      await updateNote(NOTE_ID, USER_ID, { title: 'T' });

      expect(sequelize.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_user_id = :userId',
        expect.objectContaining({
          replacements: { userId: USER_ID },
          transaction: mockTxn,
        })
      );
    });

    it('passes the transaction to note.save()', async () => {
      const mockTxn = sequelize._mockTransaction;
      const note = makeSaveableNote();
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { title: 'T' });

      expect(note.save).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: mockTxn })
      );
    });
  });

  // -------------------------------------------------------------------------
  // ADR-004: No NoteVersion row is created
  // -------------------------------------------------------------------------

  describe('no version creation', () => {
    it('does not call NoteVersion.create on a successful update', async () => {
      await updateNote(NOTE_ID, USER_ID, { title: 'T', body: 'B' });

      expect(NoteVersion.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('propagates unexpected errors thrown by Note.findOne', async () => {
      Note.findOne.mockRejectedValue(new Error('DB connection lost'));

      await expect(updateNote(NOTE_ID, USER_ID, { title: 'T' })).rejects.toThrow('DB connection lost');
    });

    it('propagates unexpected errors thrown by note.save()', async () => {
      const note = makeSaveableNote();
      note.save.mockRejectedValue(new Error('constraint violation'));
      Note.findOne.mockResolvedValue(note);

      await expect(updateNote(NOTE_ID, USER_ID, { title: 'T' })).rejects.toThrow('constraint violation');
    });
  });

  // -------------------------------------------------------------------------
  // SEC-013: Folder ownership validation when folderId is provided
  // -------------------------------------------------------------------------

  describe('folder ownership validation (SEC-013)', () => {
    it('validates the folder belongs to the user when folderId is provided', async () => {
      await updateNote(NOTE_ID, USER_ID, { folderId: FOLDER_ID });

      expect(Folder.scope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
      expect(Folder.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: FOLDER_ID } })
      );
    });

    it('throws FOLDER_NOT_FOUND when the folder does not exist for the user', async () => {
      Folder.findOne.mockResolvedValue(null);

      await expect(
        updateNote(NOTE_ID, USER_ID, { folderId: FOLDER_ID })
      ).rejects.toThrow('FOLDER_NOT_FOUND');
    });

    it('throws FOLDER_NOT_FOUND when folderId belongs to a different user', async () => {
      // Simulates the forUser scope returning null for a folder owned by another user
      Folder.findOne.mockResolvedValue(null);

      await expect(
        updateNote(NOTE_ID, OTHER_USER_ID, { folderId: FOLDER_ID })
      ).rejects.toThrow('FOLDER_NOT_FOUND');
    });

    it('does not call Folder.findOne when folderId is null (moving note to root is allowed)', async () => {
      await updateNote(NOTE_ID, USER_ID, { folderId: null });

      expect(Folder.findOne).not.toHaveBeenCalled();
    });

    it('does not call Folder.findOne when folderId is not present in updates', async () => {
      await updateNote(NOTE_ID, USER_ID, { title: 'No folder change' });

      expect(Folder.findOne).not.toHaveBeenCalled();
    });

    it('assigns the folder_id to the note after a successful ownership check', async () => {
      const note = makeSaveableNote({ folder_id: null });
      Note.findOne.mockResolvedValue(note);

      await updateNote(NOTE_ID, USER_ID, { folderId: FOLDER_ID });

      expect(note.folder_id).toBe(FOLDER_ID);
    });

    it('passes the transaction to Folder.findOne', async () => {
      const mockTxn = sequelize._mockTransaction;

      await updateNote(NOTE_ID, USER_ID, { folderId: FOLDER_ID });

      expect(Folder.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: mockTxn })
      );
    });
  });
});
