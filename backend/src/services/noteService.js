/**
 * Note service.
 *
 * Encapsulates all note CRUD business logic. Route handlers delegate to this
 * service. All methods assume the caller has already verified authentication
 * (req.session.userId) and ownership (ownershipGuard). User isolation is
 * enforced at both the application layer (userId parameter in every query)
 * and the database layer (RLS context set by rlsContext middleware, ADR-006).
 */

// TODO: TASK-009 (getNotes, getNote, updateNote), TASK-010 (deleteNote)
'use strict';

const { Note, NoteVersion, Folder, sequelize } = require('../models');

/**
 * Creates a new note with an initial version.
 *
 * Validates folder ownership when folderId is provided, then opens a single
 * database transaction that:
 *   1. Executes SET LOCAL app.current_user_id to activate RLS for the transaction
 *   2. Inserts the note row (body defaults to empty string)
 *   3. Inserts a NoteVersion row with version_number=1 as the initial snapshot
 *
 * (ADR-004 edge case: "new note with no versions always has at least one version entry")
 *
 * @param {string} userId - UUID of the authenticated user (from req.session.userId)
 * @param {object} params
 * @param {string} [params.title=''] - Note title (may be empty string, max 500 chars)
 * @param {string} [params.folderId] - Optional UUID of the target folder
 * @returns {Promise<Note>} The created Note instance with id, title, body, created_at, updated_at
 * @throws {Error} With message 'FOLDER_NOT_FOUND' if folderId is provided but does not exist or belong to userId
 *
 * @precondition userId references a valid user in the database
 * @postcondition Note row is persisted with body='', the given title, and auto-generated UUID
 * @postcondition NoteVersion row with version_number=1 is persisted in the same transaction
 */
async function createNote(userId, { title: rawTitle, folderId: rawFolderId } = {}) {
  const title = rawTitle !== undefined ? rawTitle : '';
  const folderId = rawFolderId || null;

  if (folderId !== null) {
    const folder = await Folder.scope({ method: ['forUser', userId] }).findOne({
      where: { id: folderId },
    });
    if (!folder) {
      throw new Error('FOLDER_NOT_FOUND');
    }
  }

  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId },
      transaction,
    });

    const note = await Note.create(
      {
        user_id: userId,
        title,
        body: '',
        folder_id: folderId,
      },
      { transaction }
    );

    await NoteVersion.create(
      {
        note_id: note.id,
        title: note.title,
        body: note.body,
        version_number: 1,
      },
      { transaction }
    );

    return note;
  });
}

/**
 * Returns all notes belonging to the given user, sorted by updated_at DESC.
 *
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<Note[]>} Array of Note instances (id, title, updated_at, folder_id only -- no body for list performance)
 *
 * @precondition userId references a valid user
 * @postcondition Returns only notes where user_id = userId (RLS double-enforced)
 * @postcondition Empty array returned when the user has no notes
 */
async function getNotes(userId) {
  // TODO: TASK-009 -- implement
  throw new Error('Not implemented');
}

/**
 * Returns a single note by ID, verified to belong to the given user.
 *
 * @param {string} noteId - UUID of the requested note
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<Note>} The Note instance including id, title, body, folder_id, created_at, updated_at
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 *
 * @precondition userId references a valid user
 * @postcondition Returned note has user_id === userId
 */
async function getNote(noteId, userId) {
  // TODO: TASK-009 -- implement
  throw new Error('Not implemented');
}

/**
 * Updates a note's title and/or body. Called by the auto-save path.
 *
 * This method updates the notes row ONLY. It does NOT create a NoteVersion
 * entry -- version creation is the exclusive responsibility of versionService
 * (ADR-004: auto-save owns the notes row; versioning owns note_versions inserts).
 *
 * @param {string} noteId - UUID of the note to update
 * @param {string} userId - UUID of the authenticated user
 * @param {object} updates
 * @param {string} [updates.title] - New title (omit to leave unchanged)
 * @param {string} [updates.body] - New body content (omit to leave unchanged)
 * @param {string} [updates.folderId] - New folder UUID or null to move to root
 * @returns {Promise<Note>} The updated Note instance with new updated_at
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 *
 * @precondition At least one of title, body, or folderId is provided
 * @postcondition notes.updated_at is set to current timestamp
 * @postcondition No NoteVersion row is created (that is versionService's job)
 */
async function updateNote(noteId, userId, updates) {
  // TODO: TASK-009 -- implement
  throw new Error('Not implemented');
}

/**
 * Permanently deletes a note and all its versions.
 *
 * Cascade deletion of note_versions rows is handled by the database FK
 * constraint (ON DELETE CASCADE, ADR-003) -- the service only deletes the
 * notes row.
 *
 * @param {string} noteId - UUID of the note to delete
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<void>}
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 *
 * @postcondition Note row is deleted from the database
 * @postcondition All note_versions rows for this note are deleted (DB CASCADE)
 * @postcondition Search index (search_vector) for this note is removed
 */
async function deleteNote(noteId, userId) {
  // TODO: TASK-010 -- implement
  throw new Error('Not implemented');
}

module.exports = { createNote, getNotes, getNote, updateNote, deleteNote };
