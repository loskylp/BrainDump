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

'use strict';

const express = require('express');
const router = express.Router();
const { Folder } = require('../models');
const sequelize = require('../config/database');
const authenticate = require('../middleware/authenticate');
const ownershipGuard = require('../middleware/ownershipGuard');
const rlsContext = require('../middleware/rlsContext');

// Apply authentication and RLS context to all folder routes
router.use(authenticate);
router.use(rlsContext);

/**
 * GET /api/folders
 *
 * Returns all folders belonging to the authenticated user, sorted by name ASC.
 *
 * @returns {200} { folders: Array<{ id, name, created_at, updated_at }> }
 * @returns {401} if not authenticated
 *
 * @postcondition Returns only folders where user_id = req.session.userId
 * @postcondition Empty array when user has no folders (not 404)
 * @postcondition Results ordered alphabetically by name
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const folders = await sequelize.transaction(async (t) => {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId },
        transaction: t,
        type: sequelize.constructor.QueryTypes.RAW,
      });
      return Folder.scope({ method: ['forUser', userId] }).findAll({
        order: [['name', 'ASC']],
        transaction: t,
      });
    });
    res.json({ folders });
  } catch (err) {
    next(err);
  }
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
 * @returns {400} { error: "VALIDATION_ERROR" } -- name is missing, empty, or blank
 *
 * @precondition req.body.name is a non-empty string
 * @postcondition Folder row persisted with user_id = req.session.userId
 * @postcondition Name is stored trimmed
 */
router.post('/', async (req, res, next) => {
  try {
    const rawName = req.body && req.body.name;
    if (!rawName || !rawName.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    const trimmedName = rawName.trim();
    const userId = req.session.userId;
    const folder = await sequelize.transaction(async (t) => {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId },
        transaction: t,
        type: sequelize.constructor.QueryTypes.RAW,
      });
      return Folder.create({ user_id: userId, name: trimmedName }, { transaction: t });
    });

    res.status(201).json({ folder });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/folders/:id
 *
 * Returns a single folder. Ownership is verified by ownershipGuard which
 * loads the folder into req.resource.
 *
 * @returns {200} { folder: { id, name, created_at, updated_at } }
 * @returns {404} if folder does not exist or belongs to another user
 */
router.get('/:id', ownershipGuard('Folder', 'id'), async (req, res) => {
  res.json({ folder: req.resource });
});

/**
 * PUT /api/folders/:id
 *
 * Renames a folder. Ownership is verified by ownershipGuard which loads the
 * folder into req.resource.
 *
 * Request body:
 *   { name: string }
 *
 * @returns {200} { folder: { id, name, updated_at } }
 * @returns {400} { error: "VALIDATION_ERROR" } -- name is missing, empty, or blank
 * @returns {404} if folder does not exist or belongs to another user
 *
 * @postcondition folders.name updated to trimmed value
 * @postcondition folders.updated_at refreshed
 */
router.put('/:id', ownershipGuard('Folder', 'id'), async (req, res, next) => {
  try {
    const rawName = req.body && req.body.name;
    if (!rawName || !rawName.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR' });
    }

    const userId = req.session.userId;
    req.resource.name = rawName.trim();
    await sequelize.transaction(async (t) => {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId },
        transaction: t,
        type: sequelize.constructor.QueryTypes.RAW,
      });
      await req.resource.save({ transaction: t });
    });

    res.json({ folder: req.resource });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/folders/:id
 *
 * Deletes a folder. Ownership is verified by ownershipGuard which loads the
 * folder into req.resource. Notes inside the folder automatically get
 * folder_id = NULL via the database ON DELETE SET NULL constraint (ADR-003).
 *
 * @returns {204} (no body)
 * @returns {404} if folder does not exist or belongs to another user
 *
 * @postcondition Folder row deleted
 * @postcondition All notes that were in this folder have folder_id = NULL (DB constraint)
 */
router.delete('/:id', ownershipGuard('Folder', 'id'), async (req, res, next) => {
  try {
    const userId = req.session.userId;
    await sequelize.transaction(async (t) => {
      await sequelize.query('SET LOCAL app.current_user_id = :userId', {
        replacements: { userId },
        transaction: t,
        type: sequelize.constructor.QueryTypes.RAW,
      });
      await req.resource.destroy({ transaction: t });
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
