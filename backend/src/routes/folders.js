/**
 * Folder routes.
 *
 * CRUD endpoints for user-owned folders. All routes require authentication.
 * Ownership enforcement is applied via ownershipGuard on single-resource
 * routes. Collection routes rely on the Folder model's forUser scope plus
 * the RLS context set by rlsContext middleware.
 *
 * A folder is a named, single-level organizational container for notes
 * (ADR-003). Nesting is not supported.
 */

// TODO: TASK-017
'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const ownershipGuard = require('../middleware/ownershipGuard');
const rlsContext = require('../middleware/rlsContext');

// Apply authentication and RLS context to all folder routes
router.use(authenticate);
router.use(rlsContext);

/**
 * GET /api/folders
 *
 * Returns all folders belonging to the authenticated user.
 *
 * @returns {200} { folders: Array<{ id, name, created_at, updated_at }> }
 * @returns {401} if not authenticated
 *
 * Postconditions:
 *   - Returns only folders where user_id = req.session.userId
 *   - Empty array when user has no folders (not 404)
 */
router.get('/', async (req, res, next) => {
  // TODO: TASK-017 -- implement
  next(new Error('Not implemented'));
});

/**
 * POST /api/folders
 *
 * Creates a new folder with the given name.
 *
 * Request body:
 *   { name: string }
 *
 * @returns {201} { folder: { id, name, created_at, updated_at } }
 * @returns {400} { error: "VALIDATION_ERROR" } -- name is missing or empty
 *
 * Postconditions:
 *   - Folder row persisted with user_id = req.session.userId
 */
router.post('/', async (req, res, next) => {
  // TODO: TASK-017 -- implement
  next(new Error('Not implemented'));
});

/**
 * GET /api/folders/:id
 *
 * Returns a single folder.
 *
 * @returns {200} { folder: { id, name, created_at, updated_at } }
 * @returns {404} { error: "Not found" } -- folder does not exist or belongs to another user
 */
router.get('/:id', ownershipGuard('Folder', 'id'), async (req, res, next) => {
  // TODO: TASK-017 -- implement; req.resource is the loaded Folder
  next(new Error('Not implemented'));
});

/**
 * PUT /api/folders/:id
 *
 * Renames a folder.
 *
 * Request body:
 *   { name: string }
 *
 * @returns {200} { folder: { id, name, updated_at } }
 * @returns {404} { error: "Not found" } -- folder does not exist or belongs to another user
 *
 * Postconditions:
 *   - folders.name updated
 *   - folders.updated_at refreshed
 */
router.put('/:id', ownershipGuard('Folder', 'id'), async (req, res, next) => {
  // TODO: TASK-017 -- implement
  next(new Error('Not implemented'));
});

/**
 * DELETE /api/folders/:id
 *
 * Deletes a folder. Notes inside the folder have their folder_id set to NULL
 * (ON DELETE SET NULL at the database level, ADR-003).
 *
 * @returns {204} (no body)
 * @returns {404} { error: "Not found" } -- folder does not exist or belongs to another user
 *
 * Postconditions:
 *   - Folder row deleted
 *   - All notes that were in this folder have folder_id set to NULL
 */
router.delete('/:id', ownershipGuard('Folder', 'id'), async (req, res, next) => {
  // TODO: TASK-017 -- implement
  next(new Error('Not implemented'));
});

module.exports = router;
