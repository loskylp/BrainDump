/**
 * Authentication guard middleware.
 *
 * Verifies that the incoming request is associated with a valid session before
 * allowing it to proceed. Applied to all routes under /api/notes, /api/folders,
 * and /api/versions. Not applied to /api/auth/* or /api/health.
 *
 * Contract:
 *   If req.session.userId exists (truthy UUID string):
 *     - Call next() to pass control to the next middleware or route handler
 *     - req.session.userId is the authenticated user's UUID for the remainder of the request
 *   If req.session.userId is absent or falsy:
 *     - Return HTTP 401 with JSON body: { "error": "Authentication required" }
 *     - Do NOT call next()
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 *
 * @postcondition On pass: req.session.userId is a non-empty UUID string
 * @postcondition On reject: response is finalized with status 401
 */

'use strict';

/**
 * Rejects the request with 401 and a JSON body.
 *
 * @param {import('express').Response} res
 */
function rejectUnauthenticated(res) {
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Allows the request to proceed if req.session.userId is truthy.
 * Sends HTTP 401 and terminates the request otherwise.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  if (req.session?.userId) {
    return next();
  }
  rejectUnauthenticated(res);
}

module.exports = authenticate;
