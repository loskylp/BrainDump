/**
 * Ownership guard middleware factory.
 *
 * Returns middleware that enforces per-user data isolation at the route level
 * (ADR-006 Layer 1). For single-resource routes (those with a resource ID
 * parameter), the middleware loads the resource and verifies ownership. For
 * collection routes, ownership is enforced via Sequelize default scopes and
 * the RLS context set by rlsContext middleware.
 *
 * The response on a mismatch is 404 NOT 403. This prevents resource enumeration:
 * an attacker cannot distinguish "this note exists but belongs to someone else"
 * from "this note does not exist."
 *
 * Usage:
 *   router.get('/:id', authenticate, ownershipGuard('Note', 'id'), handler)
 *   router.delete('/:noteId/versions/:versionId', authenticate, ownershipGuard('NoteVersion', 'versionId'), handler)
 *
 * @param {string} modelName - The Sequelize model name to load (e.g. 'Note', 'Folder')
 * @param {string} paramName - The request param that holds the resource UUID (e.g. 'id', 'versionId')
 * @returns {import('express').RequestHandler} Express middleware
 *
 * Returned middleware contract:
 *   Loads the resource identified by req.params[paramName] from the given model.
 *   Verifies resource.user_id === req.session.userId.
 *     On match: attaches resource to req.resource and calls next()
 *     On mismatch or not found: returns HTTP 404 { "error": "Not found" }
 *
 * @precondition authenticate middleware has already set req.session.userId
 * @precondition req.params[paramName] is a valid UUID string
 * @postcondition On pass: req.resource contains the loaded model instance
 * @postcondition On reject: response is finalized with status 404
 */

'use strict';

const sequelize = require('../config/database');
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * UUID v4 format regex. Used to reject malformed resource IDs before they
 * reach Sequelize's findByPk, which can throw a database cast error on
 * non-UUID strings (BUG-001).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sends a 404 Not Found response. Used for both "does not exist" and
 * "belongs to another user" cases to prevent resource enumeration (ADR-006).
 *
 * @param {import('express').Response} res
 */
function sendNotFound(res) {
  res.status(404).json({ error: 'Not found' });
}

/**
 * Creates an ownership-checking middleware for the named Sequelize model.
 *
 * @param {string} modelName - Key in the models registry (e.g. 'Note', 'Folder', 'NoteVersion')
 * @param {string} paramName - The req.params key that holds the resource UUID
 * @returns {import('express').RequestHandler} Async middleware that verifies ownership
 */
function ownershipGuard(modelName, paramName) {
  return async function ownershipGuardMiddleware(req, res, next) {
    try {
      const models = require('../models');
      const Model = models[modelName];
      const resourceId = req.params[paramName];

      // BUG-001: Reject malformed IDs before they reach the database.
      // Without this check, non-UUID strings (e.g. "undefined", "null",
      // arbitrary text) cause a Sequelize/Postgres cast error (500) instead
      // of the expected 404.
      if (!resourceId || !UUID_RE.test(resourceId)) {
        return sendNotFound(res);
      }

      const userId = req.session?.userId || NULL_UUID;
      const resource = await sequelize.transaction(async (t) => {
        await sequelize.query('SET LOCAL app.current_user_id = :userId', {
          replacements: { userId },
          transaction: t,
          type: sequelize.constructor.QueryTypes.RAW,
        });
        return Model.findByPk(resourceId, { transaction: t });
      });

      if (!resource) {
        return sendNotFound(res);
      }

      if (resource.user_id !== req.session.userId) {
        return sendNotFound(res);
      }

      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = ownershipGuard;
