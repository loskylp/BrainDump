/**
 * Search route.
 *
 * Full-text search endpoint scoped to the authenticated user's notes.
 * Delegates query sanitization and FTS execution to searchService.
 * This route is defined separately from notes routes because search is
 * a read-only cross-cutting operation distinct from CRUD.
 */

// TODO: TASK-014
'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const rlsContext = require('../middleware/rlsContext');
const searchService = require('../services/searchService');

router.use(authenticate);
router.use(rlsContext);

/**
 * GET /api/search?q=<query>
 *
 * Searches the authenticated user's notes using PostgreSQL full-text search.
 * Results are ranked by relevance (title matches rank higher than body matches).
 *
 * Query parameter:
 *   q  -- Raw search string from the user. Sanitized by searchService.
 *
 * @returns {200} { results: Array<{ id, title, snippet }> }
 *   - snippet: HTML fragment with <mark>term</mark> highlights (ts_headline output)
 *   - Results are ordered by relevance rank DESC
 *   - Empty array when no notes match (not 404)
 * @returns {400} { error: "EMPTY_QUERY" } -- q parameter is empty or whitespace only
 *
 * Postconditions:
 *   - Results contain only notes where user_id = req.session.userId
 *   - Query uses GIN index (no sequential scan)
 *   - Search completes in < 200ms for a 200-note collection (FF-D24)
 */
router.get('/', async (req, res, next) => {
  // TODO: TASK-014 -- implement
  next(new Error('Not implemented'));
});

module.exports = router;
