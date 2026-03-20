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

// TODO: TASK-013
'use strict';

const { Note, NoteVersion } = require('../models');

/**
 * Checks whether the current note content differs from the latest version,
 * and creates a new version row if it does.
 *
 * @param {string} noteId - UUID of the note to check
 * @param {string} userId - UUID of the authenticated user (for ownership verification)
 * @returns {Promise<{ created: boolean, version: NoteVersion | null }>}
 *   - created: true if a new version row was inserted, false if content was unchanged
 *   - version: the newly created NoteVersion instance if created=true, otherwise null
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 *
 * @precondition noteId references a note that has at least one existing version
 *               (initial version is always created at note creation by noteService)
 * @precondition The notes row already contains the latest auto-saved content
 * @postcondition If created=true: new NoteVersion row persisted with version_number = MAX(prev) + 1
 * @postcondition If created=false: no writes performed
 * @postcondition Concurrent calls for the same noteId are serialized via SELECT FOR UPDATE
 */
async function checkAndCreateVersion(noteId, userId) {
  // TODO: TASK-013 -- implement:
  // 1. Load current note (verify ownership)
  // 2. Load latest NoteVersion for this noteId (ORDER BY version_number DESC LIMIT 1)
  // 3. Compare note.body with latestVersion.body (and note.title with latestVersion.title)
  // 4. If different: open transaction, SELECT FOR UPDATE on note, INSERT NoteVersion with
  //    version_number = latestVersion.version_number + 1
  // 5. Return { created, version }
  throw new Error('Not implemented');
}

/**
 * Returns all versions of a note, ordered newest first.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<NoteVersion[]>} Array of NoteVersion instances
 *   Each entry includes: id, version_number, created_at (title and body excluded for list performance)
 * @throws {Error} With message 'NOT_FOUND' if note does not exist or belongs to a different user
 *
 * @postcondition Returns versions ordered by version_number DESC (newest first)
 * @postcondition Returns all versions with no limit (REQ-016: "100 versions shows all 100")
 */
async function getVersions(noteId, userId) {
  // TODO: TASK-013 -- implement
  throw new Error('Not implemented');
}

/**
 * Restores a note's content to the state captured in a specific version.
 *
 * Restoration is a two-step server operation (ADR-004 edge case):
 *   1. Update the notes row with the restored version's title and body
 *   2. Create a new NoteVersion entry capturing the state BEFORE restoration
 *      (so the user can undo the restore if needed)
 *
 * Both steps occur within a single database transaction.
 *
 * @param {string} noteId - UUID of the note to restore
 * @param {string} versionId - UUID of the NoteVersion to restore from
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<{ note: Note, newVersion: NoteVersion }>}
 *   - note: the updated Note instance with restored content
 *   - newVersion: the newly created NoteVersion that captured the pre-restore state
 * @throws {Error} With message 'NOT_FOUND' if note or version does not exist, or belongs to a different user
 * @throws {Error} With message 'VERSION_MISMATCH' if versionId does not belong to noteId
 *
 * @precondition versionId references a version that belongs to noteId
 * @postcondition notes row has title and body from the restored version
 * @postcondition New NoteVersion row captures the content that existed before this restore
 * @postcondition Both writes occur atomically (transaction)
 */
async function restoreVersion(noteId, versionId, userId) {
  // TODO: TASK-013 -- implement
  throw new Error('Not implemented');
}

module.exports = { checkAndCreateVersion, getVersions, restoreVersion };
