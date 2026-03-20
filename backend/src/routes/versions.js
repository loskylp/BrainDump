/**
 * Version routes.
 *
 * Endpoints for version history and the server-side version-check mechanism.
 * All routes require authentication. The check-version endpoint is the
 * server-side half of the ADR-004 dual-timer architecture -- it receives a
 * trigger from the client's 30-second idle timer and decides whether to
 * create a new version based on a content diff.
 *
 * Route parameter relationships:
 *   :id         -- UUID of the parent note
 *   :versionId  -- UUID of a specific NoteVersion row
 */

// TODO: TASK-013
'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const ownershipGuard = require('../middleware/ownershipGuard');
const rlsContext = require('../middleware/rlsContext');
const versionService = require('../services/versionService');

// Apply authentication and RLS context to all version routes
router.use(authenticate);
router.use(rlsContext);

/**
 * POST /api/notes/:id/check-version
 *
 * Triggered by the client's 30-second idle timer (useVersionTimer hook).
 * Server loads the current note and its latest version, diffs the content,
 * and conditionally inserts a new version row.
 *
 * No request body required (the server reads the current state from the DB).
 *
 * @returns {200} { versionCreated: boolean, versionNumber: number | null }
 *   - versionCreated: true if a new NoteVersion row was inserted
 *   - versionNumber: the new version number if created, otherwise null
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 *
 * Postconditions:
 *   - If content differs from latest version: new NoteVersion row persisted
 *   - If content unchanged: no write performed
 *   - Concurrent check requests are serialized (SELECT FOR UPDATE in versionService)
 */
router.post('/check-version', ownershipGuard('Note', 'id'), async (req, res, next) => {
  // TODO: TASK-013 -- implement
  next(new Error('Not implemented'));
});

/**
 * GET /api/notes/:id/versions
 *
 * Returns all versions of a note ordered by version_number DESC (newest first).
 *
 * @returns {200} { versions: Array<{ id, version_number, created_at }> }
 *   NOTE: title and body are excluded from list responses for performance;
 *   use GET /api/notes/:id/versions/:versionId to retrieve full content.
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 *
 * Postconditions:
 *   - Returns all versions with no pagination (REQ-016: 100 versions returns all 100)
 */
router.get('/', ownershipGuard('Note', 'id'), async (req, res, next) => {
  // TODO: TASK-013 -- implement
  next(new Error('Not implemented'));
});

/**
 * POST /api/notes/:id/versions/restore/:versionId
 *
 * Restores the note's content to the state of the specified version.
 * Creates a new version entry capturing the current state before restoration
 * (so the user can undo the restore).
 *
 * Both the note update and the new version creation occur in a single transaction.
 *
 * @returns {200} { note: { id, title, body, updated_at }, newVersionNumber: number }
 * @returns {404} { error: "Not found" } -- note or version not found, or belongs to another user
 * @returns {400} { error: "VERSION_MISMATCH" } -- versionId does not belong to noteId
 *
 * Postconditions:
 *   - notes row updated with title and body from the restored version
 *   - New NoteVersion row persisted with content that existed before this restore
 */
router.post('/restore/:versionId', ownershipGuard('Note', 'id'), async (req, res, next) => {
  // TODO: TASK-013 -- implement
  next(new Error('Not implemented'));
});

module.exports = router;
