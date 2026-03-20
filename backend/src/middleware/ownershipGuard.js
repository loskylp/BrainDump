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

      const resource = await Model.findByPk(resourceId);

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
