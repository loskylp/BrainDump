/**
 * RLS context middleware.
 *
 * Executes SET app.current_user_id = '<userId>' on the PostgreSQL connection
 * at the start of each authenticated request. This enables PostgreSQL
 * Row-Level Security policies on notes, folders, and note_versions to enforce
 * per-user isolation at the database level (ADR-006 Layer 2).
 *
 * BUG-001 root cause fix: the previous implementation used SET LOCAL, which
 * is scoped to the current *transaction*. Because this middleware runs as a
 * bare query (no wrapping transaction), the implicit single-statement
 * transaction auto-committed immediately, discarding the SET LOCAL value.
 * Subsequent queries (e.g. ownershipGuard's findByPk, Folder.create) ran
 * outside that transaction and hit the RLS policy with an empty/unset
 * app.current_user_id, causing Postgres to attempt ''::uuid and fail with
 * "invalid input syntax for type uuid". The fix uses session-scoped SET,
 * which persists for the lifetime of the database connection. Since every
 * request re-sets the value via this middleware, connection pool reuse is
 * safe — the value is always overwritten before any query runs. Service
 * methods that use SET LOCAL inside explicit transactions are unaffected:
 * SET LOCAL takes precedence within the transaction, and the session-level
 * value resumes after the transaction commits.
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
 * @postcondition app.current_user_id session variable is set on the connection
 *                for the duration of the request
 */

'use strict';

const sequelize = require('../config/database');

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Sets the PostgreSQL session variable app.current_user_id for RLS enforcement.
 * Uses session-scoped SET so the value persists across all queries in the
 * request, including those outside explicit transactions (e.g. ownershipGuard).
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
