/**
 * Tag routes.
 *
 * CRUD endpoints for user-owned tags (ADR-010). All routes require authentication.
 * Ownership enforcement is applied via tagService which scopes all queries
 * to the authenticated user.
 */

'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const rlsContext = require('../middleware/rlsContext');
const tagService = require('../services/tagService');
const { rateLimiter } = require('../middleware/rateLimiter');

// Apply authentication and RLS context to all tag routes
router.use(authenticate);
router.use(rlsContext);

/**
 * GET /api/tags
 *
 * Returns all tags belonging to the authenticated user, sorted by name ASC.
 *
 * @returns {200} { tags: Array<{ id, name, created_at }> }
 */
router.get('/', async (req, res, next) => {
  try {
    const tags = await tagService.getTags(req.session.userId);
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tags
 *
 * Creates a new tag. Name is normalized to lowercase. If a tag with the
 * same name already exists for this user, returns the existing tag.
 *
 * Request body:
 *   { name: string }
 *
 * @returns {201} { tag: { id, name, created_at }, created: true } -- new tag
 * @returns {200} { tag: { id, name, created_at }, created: false } -- existing tag
 * @returns {400} { error: "VALIDATION_ERROR" } -- invalid name
 */
router.post('/', rateLimiter, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const { tag, created } = await tagService.createTag(req.session.userId, name);
    res.status(created ? 201 : 200).json({ tag, created });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/tags/:id
 *
 * Deletes a tag and all its note associations (CASCADE).
 *
 * @returns {204} (no body)
 * @returns {404} if tag does not exist or belongs to another user
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await tagService.deleteTag(req.params.id, req.session.userId);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

module.exports = router;
