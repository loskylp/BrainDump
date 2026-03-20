/**
 * Unit tests for noteService.createNote (TASK-006).
 *
 * Verifies the contract:
 *   - Creates a note row with the given title, empty body, and the caller's userId
 *   - Creates an initial NoteVersion (version_number=1) in the same transaction
 *   - Returns the created Note instance
 *   - Throws 'FOLDER_NOT_FOUND' when folderId is provided but the folder does
 *     not exist or does not belong to the user
 *   - Wraps note + version creation in a single database transaction
 *   - Executes SET LOCAL app.current_user_id inside the transaction
 *
 * All database calls are mocked — no database required for these tests.
 *
 * Fitness Functions: FF-D16
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FOLDER_ID = 'ffffffff-0000-0000-0000-000000000002';
const NOTE_ID = 'dddddddd-0000-0000-0000-000000000003';
const VERSION_ID = 'eeeeeeee-0000-0000-0000-000000000004';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// We mock the models module so we can control what each model method returns.
jest.mock('../../src/models', () => {
  const mockTransaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };

  const Note = {
    scope: jest.fn().mockReturnThis(),
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

  // Expose the mockTransaction so tests can inspect calls
  sequelize._mockTransaction = mockTransaction;

  return { Note, NoteVersion, Folder, sequelize };
});

const { Note, NoteVersion, Folder, sequelize } = require('../../src/models');

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are set up
// ---------------------------------------------------------------------------

const { createNote } = require('../../src/services/noteService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain Note-like object simulating what Sequelize create() returns.
 * @param {object} overrides
 */
function makeNote(overrides = {}) {
  return {
    id: NOTE_ID,
    user_id: USER_ID,
    folder_id: null,
    title: 'Test Note',
    body: '',
    created_at: new Date('2026-03-20T10:00:00Z'),
    updated_at: new Date('2026-03-20T10:00:00Z'),
    ...overrides,
  };
}

/**
 * Returns a plain NoteVersion-like object simulating what Sequelize create() returns.
 * @param {object} overrides
 */
function makeVersion(overrides = {}) {
  return {
    id: VERSION_ID,
    note_id: NOTE_ID,
    title: 'Test Note',
    body: '',
    version_number: 1,
    created_at: new Date('2026-03-20T10:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('noteService.createNote (TASK-006)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-attach Note.scope chain since clearAllMocks resets mock return values
    Note.scope.mockReturnValue(Note);

    // Default: no folder lookup needed (folderId not provided)
    Folder.scope.mockReturnValue(Folder);
    Folder.findOne.mockResolvedValue(null);

    Note.create.mockResolvedValue(makeNote());
    NoteVersion.create.mockResolvedValue(makeVersion());
  });

  // -------------------------------------------------------------------------
  // AC-2: Note persisted with empty body and timestamps
  // -------------------------------------------------------------------------

  describe('note row creation', () => {
    it('creates a note with the given title', async () => {
      Note.create.mockResolvedValue(makeNote({ title: 'My Note' }));

      const result = await createNote(USER_ID, { title: 'My Note' });

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Note' }),
        expect.any(Object)
      );
      expect(result.title).toBe('My Note');
    });

    it('creates a note with an empty body', async () => {
      Note.create.mockResolvedValue(makeNote({ title: 'My Note', body: '' }));

      await createNote(USER_ID, { title: 'My Note' });

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({ body: '' }),
        expect.any(Object)
      );
    });

    it('assigns the note to the given userId', async () => {
      await createNote(USER_ID, { title: 'My Note' });

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: USER_ID }),
        expect.any(Object)
      );
    });

    it('sets folder_id to null when no folderId is provided', async () => {
      await createNote(USER_ID, { title: 'My Note' });

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({ folder_id: null }),
        expect.any(Object)
      );
    });

    it('uses empty string as title when title is omitted', async () => {
      Note.create.mockResolvedValue(makeNote({ title: '' }));

      await createNote(USER_ID, {});

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: '' }),
        expect.any(Object)
      );
    });

    it('returns the created Note instance', async () => {
      const note = makeNote({ title: 'Returned Note' });
      Note.create.mockResolvedValue(note);

      const result = await createNote(USER_ID, { title: 'Returned Note' });

      expect(result).toBe(note);
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Initial version created atomically in same transaction
  // -------------------------------------------------------------------------

  describe('initial version creation', () => {
    it('creates a NoteVersion with version_number 1', async () => {
      const note = makeNote({ title: 'My Note' });
      Note.create.mockResolvedValue(note);

      await createNote(USER_ID, { title: 'My Note' });

      expect(NoteVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ version_number: 1 }),
        expect.any(Object)
      );
    });

    it('creates a NoteVersion with the new note id as note_id', async () => {
      const note = makeNote({ id: NOTE_ID });
      Note.create.mockResolvedValue(note);

      await createNote(USER_ID, { title: 'My Note' });

      expect(NoteVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ note_id: NOTE_ID }),
        expect.any(Object)
      );
    });

    it('creates a NoteVersion with the note title as a snapshot', async () => {
      const note = makeNote({ title: 'Snapshot Title' });
      Note.create.mockResolvedValue(note);

      await createNote(USER_ID, { title: 'Snapshot Title' });

      expect(NoteVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Snapshot Title' }),
        expect.any(Object)
      );
    });

    it('creates a NoteVersion with empty body matching the note body', async () => {
      const note = makeNote({ body: '' });
      Note.create.mockResolvedValue(note);

      await createNote(USER_ID, { title: 'My Note' });

      expect(NoteVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ body: '' }),
        expect.any(Object)
      );
    });

    it('creates exactly one NoteVersion per note creation', async () => {
      await createNote(USER_ID, { title: 'My Note' });

      expect(NoteVersion.create).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Atomicity — both writes inside a transaction
  // -------------------------------------------------------------------------

  describe('transaction wrapping', () => {
    it('wraps note and version creation in a sequelize transaction', async () => {
      await createNote(USER_ID, { title: 'My Note' });

      expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    });

    it('passes the transaction to Note.create', async () => {
      const mockTxn = sequelize._mockTransaction;

      await createNote(USER_ID, { title: 'My Note' });

      expect(Note.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ transaction: mockTxn })
      );
    });

    it('passes the transaction to NoteVersion.create', async () => {
      const mockTxn = sequelize._mockTransaction;

      await createNote(USER_ID, { title: 'My Note' });

      expect(NoteVersion.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ transaction: mockTxn })
      );
    });

    it('executes SET LOCAL app.current_user_id inside the transaction', async () => {
      const mockTxn = sequelize._mockTransaction;

      await createNote(USER_ID, { title: 'My Note' });

      expect(sequelize.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_user_id = :userId',
        expect.objectContaining({
          replacements: { userId: USER_ID },
          transaction: mockTxn,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Duplicate titles allowed — no title uniqueness check
  // -------------------------------------------------------------------------

  describe('duplicate title handling', () => {
    it('does not throw when the same title is created twice', async () => {
      Note.create.mockResolvedValueOnce(makeNote({ title: 'Duplicate' }));
      Note.create.mockResolvedValueOnce(makeNote({ title: 'Duplicate' }));

      await expect(createNote(USER_ID, { title: 'Duplicate' })).resolves.toBeDefined();
      await expect(createNote(USER_ID, { title: 'Duplicate' })).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // folderId validation — 404 when folder not found or not owned
  // -------------------------------------------------------------------------

  describe('folder validation', () => {
    it('throws FOLDER_NOT_FOUND when folderId is provided but folder does not exist', async () => {
      Folder.findOne.mockResolvedValue(null);

      await expect(
        createNote(USER_ID, { title: 'My Note', folderId: FOLDER_ID })
      ).rejects.toThrow('FOLDER_NOT_FOUND');
    });

    it('throws FOLDER_NOT_FOUND when folderId belongs to a different user', async () => {
      // findOne with the user-scoped query returns null (folder exists but is not owned by USER_ID)
      Folder.scope.mockReturnValue(Folder);
      Folder.findOne.mockResolvedValue(null);

      await expect(
        createNote(USER_ID, { title: 'My Note', folderId: FOLDER_ID })
      ).rejects.toThrow('FOLDER_NOT_FOUND');
    });

    it('does not create note or version when folder validation fails', async () => {
      Folder.findOne.mockResolvedValue(null);

      try {
        await createNote(USER_ID, { title: 'My Note', folderId: FOLDER_ID });
      } catch {
        // expected
      }

      expect(Note.create).not.toHaveBeenCalled();
      expect(NoteVersion.create).not.toHaveBeenCalled();
    });

    it('assigns folder_id to the note when a valid folder is provided', async () => {
      const folder = { id: FOLDER_ID, user_id: USER_ID };
      Folder.scope.mockReturnValue(Folder);
      Folder.findOne.mockResolvedValue(folder);
      Note.create.mockResolvedValue(makeNote({ folder_id: FOLDER_ID }));

      await createNote(USER_ID, { title: 'My Note', folderId: FOLDER_ID });

      expect(Note.create).toHaveBeenCalledWith(
        expect.objectContaining({ folder_id: FOLDER_ID }),
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('propagates database errors thrown by Note.create', async () => {
      const dbError = new Error('DB connection lost');
      Note.create.mockRejectedValue(dbError);

      await expect(createNote(USER_ID, { title: 'My Note' })).rejects.toThrow('DB connection lost');
    });

    it('propagates database errors thrown by NoteVersion.create', async () => {
      const dbError = new Error('constraint violation');
      NoteVersion.create.mockRejectedValue(dbError);

      await expect(createNote(USER_ID, { title: 'My Note' })).rejects.toThrow('constraint violation');
    });
  });
});
