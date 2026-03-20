/**
 * RLS context middleware.
 *
 * Executes SET LOCAL app.current_user_id = '<userId>' on the PostgreSQL
 * connection at the start of each authenticated request. This enables
 * PostgreSQL Row-Level Security policies on notes, folders, and note_versions
 * to enforce per-user isolation at the database level (ADR-006 Layer 2).
 *
 * The SET LOCAL scope ensures the variable is visible only within the current
 * transaction, preventing leakage between requests on pooled connections.
 *
 * For unauthenticated requests reaching this middleware (public routes), the
 * variable is set to a null UUID value ('00000000-0000-0000-0000-000000000000')
 * that matches no rows in any RLS policy.
 *
 * This middleware must run AFTER authenticate on protected routes.
 * On public routes it may run without a session -- the null UUID is safe.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 *
 * @precondition Database connection is reachable
 * @postcondition app.current_user_id session variable is set for the duration
 *                of the current request's database transaction
 */

'use strict';

const sequelize = require('../config/database');

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Sets the PostgreSQL session variable app.current_user_id for RLS enforcement.
 * Uses SET LOCAL to scope the variable to the current transaction only.
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
async function rlsContext(req, res, next) {
  try {
    const userId = req.session?.userId || NULL_UUID;
    await sequelize.query('SET LOCAL app.current_user_id = :userId', {
      replacements: { userId },
      type: sequelize.constructor.QueryTypes.RAW,
    });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = rlsContext;
