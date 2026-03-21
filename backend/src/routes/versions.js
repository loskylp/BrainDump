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
 * @returns {200} { versionCreated: boolean, versionNumber: number | null }
 * @returns {404} { error: "Not found" }
 */
router.post('/check-version', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    const { created, version } = await versionService.checkAndCreateVersion(
      req.params.id,
      req.session.userId
    );
    res.json({
      versionCreated: created,
      versionNumber: version ? version.version_number : null,
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

/**
 * GET /api/notes/:id/versions
 *
 * Returns all versions of a note ordered by version_number DESC (newest first).
 *
 * @returns {200} { versions: Array<{ id, version_number, title, body, created_at }> }
 * @returns {404} { error: "Not found" }
 */
router.get('/versions', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    const versions = await versionService.getVersions(
      req.params.id,
      req.session.userId
    );
    res.json({ versions });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

/**
 * GET /api/notes/:id/versions/:versionId
 *
 * Returns the content of a specific version.
 *
 * @returns {200} { version: { id, version_number, title, body, created_at } }
 * @returns {404} { error: "Not found" }
 * @returns {400} { error: "VERSION_MISMATCH" }
 */
router.get('/versions/:versionId', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    const version = await versionService.getVersion(
      req.params.id,
      req.params.versionId,
      req.session.userId
    );
    res.json({ version });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    if (err.message === 'VERSION_MISMATCH') {
      return res.status(400).json({ error: 'VERSION_MISMATCH' });
    }
    next(err);
  }
});

/**
 * POST /api/notes/:id/versions/restore/:versionId
 *
 * Restores the note's content to the state of the specified version.
 *
 * @returns {200} { note: { id, title, body, updated_at }, newVersionNumber: number }
 * @returns {404} { error: "Not found" }
 * @returns {400} { error: "VERSION_MISMATCH" }
 */
router.post('/restore/:versionId', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    const { note, newVersion } = await versionService.restoreVersion(
      req.params.id,
      req.params.versionId,
      req.session.userId
    );
    res.json({
      note: {
        id: note.id,
        title: note.title,
        body: note.body,
        updated_at: note.updated_at,
      },
      newVersionNumber: newVersion.version_number,
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    if (err.message === 'VERSION_MISMATCH') {
      return res.status(400).json({ error: 'VERSION_MISMATCH' });
    }
    next(err);
  }
});

module.exports = router;
