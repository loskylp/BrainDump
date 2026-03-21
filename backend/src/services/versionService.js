/**
 * Version service.
 *
 * Manages note version snapshots. Version creation is server-authoritative:
 * the client triggers a check via POST /api/notes/:id/check-version, and this
 * service decides whether to create a new version based on a content diff
 * (ADR-004). The client cannot force version creation or skip the diff check.
 *
 * Timer interaction rules (ADR-004):
 *   - Auto-save (2s debounce) fires first and updates notes.body
 *   - Version check (30s idle) fires later and reads notes.body to diff
 *   - By the time checkAndCreateVersion is called, the note row already has
 *     the latest content from auto-save
 *   - If content is unchanged since the last version, no row is inserted
 *
 * Concurrency: version_number is assigned by reading the current MAX + 1 within
 * a transaction with SELECT FOR UPDATE to prevent duplicate version numbers from
 * concurrent check requests (ADR-004 consequence note).
 */

'use strict';

const { Note, NoteVersion, sequelize } = require('../models');

/**
 * Checks whether the current note content differs from the latest version,
 * and creates a new version row if it does.
 *
 * @param {string} noteId - UUID of the note to check
 * @param {string} userId - UUID of the authenticated user (for ownership verification)
 * @returns {Promise<{ created: boolean, version: NoteVersion | null }>}
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 */
async function checkAndCreateVersion(noteId, userId) {
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId },
      transaction,
    });

    // Lock the note row to prevent concurrent version creation races
    const note = await Note.scope({ method: ['forUser', userId] }).findOne({
      where: { id: noteId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!note) {
      throw new Error('NOT_FOUND');
    }

    // Load the latest version for comparison
    const latestVersion = await NoteVersion.findOne({
      where: { note_id: noteId },
      order: [['version_number', 'DESC']],
      transaction,
    });

    // Compare content: if no version exists or content differs, create new version
    if (
      latestVersion &&
      latestVersion.title === note.title &&
      latestVersion.body === note.body
    ) {
      return { created: false, version: null };
    }

    const nextVersionNumber = latestVersion
      ? latestVersion.version_number + 1
      : 1;

    const version = await NoteVersion.create(
      {
        note_id: noteId,
        title: note.title,
        body: note.body,
        version_number: nextVersionNumber,
      },
      { transaction }
    );

    return { created: true, version };
  });
}

/**
 * Returns all versions of a note, ordered newest first.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<NoteVersion[]>} Array of NoteVersion instances
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 */
async function getVersions(noteId, userId) {
  // Verify note ownership
  const note = await Note.scope({ method: ['forUser', userId] }).findOne({
    where: { id: noteId },
  });

  if (!note) {
    throw new Error('NOT_FOUND');
  }

  return NoteVersion.findAll({
    where: { note_id: noteId },
    attributes: ['id', 'version_number', 'title', 'body', 'created_at'],
    order: [['version_number', 'DESC']],
  });
}

/**
 * Returns a single version by ID.
 *
 * @param {string} noteId - UUID of the parent note
 * @param {string} versionId - UUID of the NoteVersion
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<NoteVersion>}
 * @throws {Error} With message 'NOT_FOUND' if note or version does not exist
 * @throws {Error} With message 'VERSION_MISMATCH' if versionId does not belong to noteId
 */
async function getVersion(noteId, versionId, userId) {
  // Verify note ownership
  const note = await Note.scope({ method: ['forUser', userId] }).findOne({
    where: { id: noteId },
  });

  if (!note) {
    throw new Error('NOT_FOUND');
  }

  const version = await NoteVersion.findOne({
    where: { id: versionId },
  });

  if (!version) {
    throw new Error('NOT_FOUND');
  }

  if (version.note_id !== noteId) {
    throw new Error('VERSION_MISMATCH');
  }

  return version;
}

/**
 * Restores a note's content to the state captured in a specific version.
 *
 * @param {string} noteId - UUID of the note to restore
 * @param {string} versionId - UUID of the NoteVersion to restore from
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<{ note: Note, newVersion: NoteVersion }>}
 * @throws {Error} With message 'NOT_FOUND' if note or version does not exist
 * @throws {Error} With message 'VERSION_MISMATCH' if versionId does not belong to noteId
 */
async function restoreVersion(noteId, versionId, userId) {
  return sequelize.transaction(async (transaction) => {
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId },
      transaction,
    });

    const note = await Note.scope({ method: ['forUser', userId] }).findOne({
      where: { id: noteId },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!note) {
      throw new Error('NOT_FOUND');
    }

    const targetVersion = await NoteVersion.findOne({
      where: { id: versionId },
      transaction,
    });

    if (!targetVersion) {
      throw new Error('NOT_FOUND');
    }

    if (targetVersion.note_id !== noteId) {
      throw new Error('VERSION_MISMATCH');
    }

    // Get the current max version number
    const latestVersion = await NoteVersion.findOne({
      where: { note_id: noteId },
      order: [['version_number', 'DESC']],
      transaction,
    });

    const nextVersionNumber = latestVersion
      ? latestVersion.version_number + 1
      : 1;

    // Create a new version capturing the state BEFORE restoration
    const newVersion = await NoteVersion.create(
      {
        note_id: noteId,
        title: note.title,
        body: note.body,
        version_number: nextVersionNumber,
      },
      { transaction }
    );

    // Update the note with the restored version's content
    note.title = targetVersion.title;
    note.body = targetVersion.body;
    await note.save({ transaction });

    return { note, newVersion };
  });
}

module.exports = { checkAndCreateVersion, getVersions, getVersion, restoreVersion };
