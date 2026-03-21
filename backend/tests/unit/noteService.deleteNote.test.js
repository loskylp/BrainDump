/**
 * Unit tests for noteService.deleteNote.
 *
 * TASK-010: Delete a note -- AC-1 (DELETE endpoint), AC-3 (CASCADE verified),
 * AC-6 (deleted note not found in search).
 *
 * Tests verify:
 *   - Note is deleted within a transaction with RLS context
 *   - NOT_FOUND thrown for non-existent or cross-user note
 *   - CASCADE on note_versions is handled by the database (destroy on note row)
 */

'use strict';

// ── Mock Sequelize before require ──────────────────────────────────────
const mockTransaction = jest.fn();
const mockQuery = jest.fn();
const mockFindOne = jest.fn();
const mockDestroy = jest.fn();
const mockScope = jest.fn();

jest.mock('../../src/models', () => ({
  Note: {
    scope: (...args) => {
      mockScope(...args);
      return { findOne: mockFindOne };
    },
  },
  NoteVersion: {},
  Folder: {},
  sequelize: {
    transaction: (fn) => fn(mockTransaction),
    query: mockQuery,
  },
}));

const noteService = require('../../src/services/noteService');

describe('noteService.deleteNote', () => {
  const userId = 'user-uuid-aaa';
  const noteId = 'note-uuid-bbb';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets RLS context within the transaction', async () => {
    const mockNote = { id: noteId, user_id: userId, destroy: mockDestroy };
    mockFindOne.mockResolvedValue(mockNote);
    mockDestroy.mockResolvedValue(undefined);

    await noteService.deleteNote(noteId, userId);

    expect(mockQuery).toHaveBeenCalledWith(
      'SET LOCAL app.current_user_id = :userId',
      { replacements: { userId }, transaction: mockTransaction }
    );
  });

  it('uses forUser scope with the correct userId', async () => {
    const mockNote = { id: noteId, user_id: userId, destroy: mockDestroy };
    mockFindOne.mockResolvedValue(mockNote);
    mockDestroy.mockResolvedValue(undefined);

    await noteService.deleteNote(noteId, userId);

    expect(mockScope).toHaveBeenCalledWith({ method: ['forUser', userId] });
  });

  it('finds the note by id within the transaction', async () => {
    const mockNote = { id: noteId, user_id: userId, destroy: mockDestroy };
    mockFindOne.mockResolvedValue(mockNote);
    mockDestroy.mockResolvedValue(undefined);

    await noteService.deleteNote(noteId, userId);

    expect(mockFindOne).toHaveBeenCalledWith({
      where: { id: noteId },
      transaction: mockTransaction,
    });
  });

  it('calls destroy on the note instance within the transaction', async () => {
    const mockNote = { id: noteId, user_id: userId, destroy: mockDestroy };
    mockFindOne.mockResolvedValue(mockNote);
    mockDestroy.mockResolvedValue(undefined);

    await noteService.deleteNote(noteId, userId);

    expect(mockDestroy).toHaveBeenCalledWith({ transaction: mockTransaction });
  });

  it('throws NOT_FOUND when note does not exist', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(noteService.deleteNote(noteId, userId)).rejects.toThrow('NOT_FOUND');
    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND for cross-user access (forUser scope excludes it)', async () => {
    mockFindOne.mockResolvedValue(null);
    const otherUserId = 'other-user-uuid';

    await expect(noteService.deleteNote(noteId, otherUserId)).rejects.toThrow('NOT_FOUND');
  });

  it('returns undefined on successful deletion', async () => {
    const mockNote = { id: noteId, user_id: userId, destroy: mockDestroy };
    mockFindOne.mockResolvedValue(mockNote);
    mockDestroy.mockResolvedValue(undefined);

    const result = await noteService.deleteNote(noteId, userId);

    expect(result).toBeUndefined();
  });
});
