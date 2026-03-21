/**
 * Notes routes.
 *
 * CRUD endpoints for user-owned notes. All routes require authentication.
 * Ownership enforcement is applied via ownershipGuard on single-resource
 * routes. Collection routes rely on noteService's user-scoped queries plus
 * the RLS context set by rlsContext middleware.
 *
 * Auto-save path: PUT /api/notes/:id (TASK-009)
 * Version check path: POST /api/notes/:id/check-version (in versions.js)
 */

'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const ownershipGuard = require('../middleware/ownershipGuard');
const rlsContext = require('../middleware/rlsContext');
const noteService = require('../services/noteService');

// Apply authentication and RLS context to all notes routes
router.use(authenticate);
router.use(rlsContext);

/**
 * GET /api/notes
 *
 * Returns all notes belonging to the authenticated user, sorted by updated_at DESC.
 *
 * @returns {200} { notes: Array<{ id, title, updated_at, folder_id }> }
 *   NOTE: body is excluded from list responses for performance.
 *
 * Postconditions:
 *   - Returns only notes where user_id = req.session.userId
 *   - Empty array when user has no notes (not 404)
 */
router.get('/', async (req, res, next) => {
  try {
    const notes = await noteService.getNotes(req.session.userId);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notes
 *
 * Creates a new note with an initial version.
 *
 * Request body:
 *   { title?: string, folderId?: string }
 *   title defaults to empty string if omitted.
 *
 * @returns {201} { note: { id, title, body, folder_id, created_at, updated_at } }
 * @returns {404} { error: "Not found" } -- folderId provided but not found or not owned by user
 *
 * Postconditions:
 *   - Note row persisted with user_id = req.session.userId
 *   - NoteVersion row with version_number=1 persisted in same transaction
 */
router.post('/', async (req, res, next) => {
  try {
    const { title = '', folderId } = req.body;
    const note = await noteService.createNote(req.session.userId, { title, folderId });
    res.status(201).json({ note });
  } catch (err) {
    if (err.message === 'FOLDER_NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

/**
 * GET /api/notes/:id
 *
 * Returns the full content of a single note.
 *
 * @returns {200} { note: { id, title, body, folder_id, created_at, updated_at } }
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 */
router.get('/:id', ownershipGuard('Note', 'id'), async (req, res, _next) => {
  // ownershipGuard has already verified ownership and attached the Note instance
  // to req.resource. Return it directly — no further service call needed.
  res.json({ note: req.resource });
});

/**
 * PUT /api/notes/:id
 *
 * Updates the title and/or body of a note. This is the auto-save endpoint.
 * Does NOT create a NoteVersion entry (that is POST /api/notes/:id/check-version).
 *
 * Request body:
 *   { title?: string, body?: string, folderId?: string | null }
 *
 * @returns {200} { note: { id, title, body, updated_at } }
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 *
 * Postconditions:
 *   - notes.updated_at is refreshed
 *   - No NoteVersion row is created
 */
router.put('/:id', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    const updates = {};
    if ('title' in req.body) updates.title = req.body.title;
    if ('body' in req.body) updates.body = req.body.body;
    if ('folderId' in req.body) updates.folderId = req.body.folderId;
    const note = await noteService.updateNote(req.params.id, req.session.userId, updates);
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notes/:id
 *
 * Permanently deletes a note and all its versions.
 *
 * @returns {204} (no body)
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 *
 * Postconditions:
 *   - Note row deleted
 *   - All associated NoteVersion rows deleted (DB CASCADE)
 */
router.delete('/:id', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    await noteService.deleteNote(req.params.id, req.session.userId);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

module.exports = router;
