/**
 * Express session configuration.
 *
 * Constructs the session middleware options for express-session, wiring in the
 * connect-pg-simple PostgreSQL session store. Session rows are stored in the
 * "session" table, which is created by the Sequelize migration
 * 20260319000007-create-sessions.js before the application starts.
 *
 * Session contract (ADR-002):
 *   - Store: connect-pg-simple backed by the application PostgreSQL database
 *   - Cookie: httpOnly=true, secure=true in production, sameSite='strict'
 *   - Lifetime: 7 days (maxAge), rolling expiry (resave updates expiry on activity)
 *   - Session identity anchor: req.session.userId (UUID string)
 *
 * Environment variables (see .env.example):
 *   SESSION_SECRET  -- Cookie signing secret (required, must be unique per env)
 *   NODE_ENV        -- Determines cookie.secure setting
 *   POSTGRES_URL    -- Passed to the connect-pg-simple store constructor
 *
 * Returns:
 *   Express middleware function produced by express-session(options).
 *
 * Preconditions:
 *   - POSTGRES_URL is set and the database is reachable
 *   - SESSION_SECRET is set to a non-empty string
 *
 * Postconditions:
 *   - Session rows are persisted in the "session" table on each authenticated request
 *   - Session cookie is set with the configured security options
 */

'use strict';

require('dotenv').config();

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const isProduction = process.env.NODE_ENV === 'production';

const sessionMiddleware = session({
  store: new pgSession({
    conString: process.env.POSTGRES_URL,
    tableName: 'session',
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
  },
});

module.exports = sessionMiddleware;
