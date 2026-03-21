/**
 * Unit tests for versionService (TASK-013).
 *
 * Tests verify:
 *   AC-3: Server-side diff check compares current note with latest version
 *   AC-4: If content differs, new NoteVersion row is inserted
 *   AC-5: If content unchanged, no new version is created
 *   AC-6: getVersions returns all versions newest first
 *   AC-8: restoreVersion captures pre-restore state and updates note
 *
 * All Sequelize models are mocked -- no database required.
 */

'use strict';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const mockQuery = jest.fn();
const mockNoteFindOne = jest.fn();
const mockNoteVersionFindOne = jest.fn();
const mockNoteVersionFindAll = jest.fn();
const mockNoteVersionCreate = jest.fn();
const mockNoteScope = jest.fn();

jest.mock('../../src/models', () => ({
  Note: {
    scope: (...args) => {
      mockNoteScope(...args);
      return { findOne: mockNoteFindOne };
    },
  },
  NoteVersion: {
    findOne: (...args) => mockNoteVersionFindOne(...args),
    findAll: (...args) => mockNoteVersionFindAll(...args),
    create: (...args) => mockNoteVersionCreate(...args),
  },
  sequelize: {
    transaction: (fn) => fn(mockTransaction),
    query: mockQuery,
  },
}));

const versionService = require('../../src/services/versionService');

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-aaa';
const NOTE_ID = 'note-uuid-bbb';
const VERSION_ID_1 = 'version-uuid-111';
const VERSION_ID_2 = 'version-uuid-222';

function makeNote(overrides = {}) {
  return {
    id: NOTE_ID,
    user_id: USER_ID,
    title: 'Current Title',
    body: 'Current body content',
    save: jest.fn(),
    ...overrides,
  };
}

function makeVersion(overrides = {}) {
  return {
    id: VERSION_ID_1,
    note_id: NOTE_ID,
    title: 'Original Title',
    body: 'Original body content',
    version_number: 1,
    created_at: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('versionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // checkAndCreateVersion
  // -------------------------------------------------------------------------

  describe('checkAndCreateVersion', () => {
    it('sets RLS context within the transaction', async () => {
      const note = makeNote();
      const version = makeVersion({ title: note.title, body: note.body });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(version);

      await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(mockQuery).toHaveBeenCalledWith(
        'SET LOCAL app.current_user_id = :userId',
        { replacements: { userId: USER_ID }, transaction: mockTransaction }
      );
    });

    it('uses forUser scope for ownership verification', async () => {
      const note = makeNote();
      const version = makeVersion({ title: note.title, body: note.body });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(version);

      await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(mockNoteScope).toHaveBeenCalledWith({ method: ['forUser', USER_ID] });
    });

    it('throws NOT_FOUND when note does not exist', async () => {
      mockNoteFindOne.mockResolvedValue(null);

      await expect(
        versionService.checkAndCreateVersion(NOTE_ID, USER_ID)
      ).rejects.toThrow('NOT_FOUND');
    });

    it('returns created=false when content is unchanged (AC-5)', async () => {
      const note = makeNote({ title: 'Same', body: 'Same' });
      const version = makeVersion({ title: 'Same', body: 'Same', version_number: 1 });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(version);

      const result = await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(result.created).toBe(false);
      expect(result.version).toBeNull();
      expect(mockNoteVersionCreate).not.toHaveBeenCalled();
    });

    it('creates a new version when content differs (AC-4)', async () => {
      const note = makeNote({ title: 'Updated', body: 'Changed body' });
      const latestVersion = makeVersion({ title: 'Original', body: 'Original body', version_number: 2 });
      const newVersion = makeVersion({ title: 'Updated', body: 'Changed body', version_number: 3, id: VERSION_ID_2 });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(latestVersion);
      mockNoteVersionCreate.mockResolvedValue(newVersion);

      const result = await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(result.created).toBe(true);
      expect(result.version).toEqual(newVersion);
      expect(mockNoteVersionCreate).toHaveBeenCalledWith(
        {
          note_id: NOTE_ID,
          title: 'Updated',
          body: 'Changed body',
          version_number: 3,
        },
        { transaction: mockTransaction }
      );
    });

    it('creates version 1 when no prior versions exist', async () => {
      const note = makeNote();
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(null);
      mockNoteVersionCreate.mockResolvedValue(makeVersion({ version_number: 1 }));

      const result = await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(result.created).toBe(true);
      expect(mockNoteVersionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ version_number: 1 }),
        expect.any(Object)
      );
    });

    it('creates a version when only the title changed', async () => {
      const note = makeNote({ title: 'New Title', body: 'Same body' });
      const latestVersion = makeVersion({ title: 'Old Title', body: 'Same body', version_number: 1 });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(latestVersion);
      mockNoteVersionCreate.mockResolvedValue(makeVersion({ version_number: 2 }));

      const result = await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(result.created).toBe(true);
    });

    it('locks the note row with SELECT FOR UPDATE', async () => {
      const note = makeNote({ title: 'Same', body: 'Same' });
      const version = makeVersion({ title: 'Same', body: 'Same' });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(version);

      await versionService.checkAndCreateVersion(NOTE_ID, USER_ID);

      expect(mockNoteFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          lock: 'UPDATE',
          transaction: mockTransaction,
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getVersions
  // -------------------------------------------------------------------------

  describe('getVersions', () => {
    it('returns versions ordered by version_number DESC (AC-6)', async () => {
      const note = makeNote();
      mockNoteFindOne.mockResolvedValue(note);
      const versions = [
        makeVersion({ version_number: 3 }),
        makeVersion({ version_number: 2 }),
        makeVersion({ version_number: 1 }),
      ];
      mockNoteVersionFindAll.mockResolvedValue(versions);

      const result = await versionService.getVersions(NOTE_ID, USER_ID);

      expect(result).toEqual(versions);
      expect(mockNoteVersionFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['version_number', 'DESC']],
        })
      );
    });

    it('throws NOT_FOUND when note does not exist', async () => {
      mockNoteFindOne.mockResolvedValue(null);

      await expect(
        versionService.getVersions(NOTE_ID, USER_ID)
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // restoreVersion
  // -------------------------------------------------------------------------

  describe('restoreVersion', () => {
    it('creates a pre-restore version and updates the note (AC-8)', async () => {
      const note = makeNote({ title: 'Current', body: 'Current body' });
      const targetVersion = makeVersion({
        id: VERSION_ID_1,
        note_id: NOTE_ID,
        title: 'Old Title',
        body: 'Old body',
        version_number: 1,
      });
      const latestVersion = makeVersion({ version_number: 2 });
      const preRestoreVersion = makeVersion({ version_number: 3, id: VERSION_ID_2 });

      mockNoteFindOne.mockResolvedValue(note);
      // First call: target version, Second call: latest version for numbering
      mockNoteVersionFindOne
        .mockResolvedValueOnce(targetVersion)
        .mockResolvedValueOnce(latestVersion);
      mockNoteVersionCreate.mockResolvedValue(preRestoreVersion);

      const result = await versionService.restoreVersion(NOTE_ID, VERSION_ID_1, USER_ID);

      // Pre-restore version captures current state
      expect(mockNoteVersionCreate).toHaveBeenCalledWith(
        {
          note_id: NOTE_ID,
          title: 'Current',
          body: 'Current body',
          version_number: 3,
        },
        { transaction: mockTransaction }
      );

      // Note is updated with restored content
      expect(note.title).toBe('Old Title');
      expect(note.body).toBe('Old body');
      expect(note.save).toHaveBeenCalledWith({ transaction: mockTransaction });
    });

    it('throws NOT_FOUND when note does not exist', async () => {
      mockNoteFindOne.mockResolvedValue(null);

      await expect(
        versionService.restoreVersion(NOTE_ID, VERSION_ID_1, USER_ID)
      ).rejects.toThrow('NOT_FOUND');
    });

    it('throws NOT_FOUND when version does not exist', async () => {
      const note = makeNote();
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(null);

      await expect(
        versionService.restoreVersion(NOTE_ID, 'nonexistent-id', USER_ID)
      ).rejects.toThrow('NOT_FOUND');
    });

    it('throws VERSION_MISMATCH when version belongs to different note', async () => {
      const note = makeNote();
      const wrongVersion = makeVersion({ note_id: 'other-note-id' });
      mockNoteFindOne.mockResolvedValue(note);
      mockNoteVersionFindOne.mockResolvedValue(wrongVersion);

      await expect(
        versionService.restoreVersion(NOTE_ID, VERSION_ID_1, USER_ID)
      ).rejects.toThrow('VERSION_MISMATCH');
    });
  });
});
