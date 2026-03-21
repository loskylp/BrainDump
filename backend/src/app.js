/**
 * Express application factory.
 *
 * Constructs and configures the Express application: middleware chain, route
 * mounting, error handling. Does NOT start the HTTP server (that is server.js).
 * Exporting the app separately allows tests to import it without binding a port.
 *
 * Middleware chain order:
 *   1. helmet()            -- security headers
 *   2. cors()              -- CORS for Vite dev proxy (development only)
 *   3. express.json()      -- JSON body parsing
 *   4. sessionMiddleware   -- express-session with PostgreSQL store (TASK-004)
 *   5. Routes:
 *        /api/health       -- health check (unauthenticated)
 *        /api/auth         -- registration, login, logout, password reset (TASK-003/004/015)
 *        /api/notes        -- note CRUD (TASK-006/009/010)
 *        /api/notes/:id    -- version history routes (TASK-013, mergeParams)
 *        /api/folders      -- folder CRUD (TASK-017)
 *        /api/search       -- full-text search (TASK-014)
 *   6. Static file serving -- serves frontend build in production
 *   7. SPA fallback        -- serves index.html for client-side routes in production
 *   8. 404 handler         -- catches unmatched API routes
 *   9. Error handler       -- centralised error -> HTTP response mapping
 *
 * Error handler maps service-layer errors to HTTP codes:
 *   NOT_FOUND            -> 404
 *   EMAIL_TAKEN          -> 409
 *   INVALID_CREDENTIALS  -> 401
 *   INVALID_TOKEN        -> 400
 *   VALIDATION_ERROR     -> 400
 *   VERSION_MISMATCH     -> 400
 *   EMPTY_QUERY          -> 400
 *   (all others)         -> 500
 */

'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const healthRouter = require('./routes/health');
const authRouter = require('./routes/auth');
const notesRouter = require('./routes/notes');
const versionsRouter = require('./routes/versions');
const foldersRouter = require('./routes/folders');
const searchRouter = require('./routes/search');
const sessionMiddleware = require('./config/session');

const app = express();

// Trust the first proxy (Traefik). Required so that req.secure === true when
// Traefik terminates TLS and forwards over plain HTTP. Without this,
// express-session will not set the session cookie in production because it
// sees the request as non-HTTPS.
app.set('trust proxy', 1);

// --- Middleware chain ---

// 1. Security headers
app.use(helmet());

// 2. CORS (permissive in development for Vite dev proxy)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true,
}));

// 3. JSON body parsing
app.use(express.json());

// 4. Session middleware (ADR-002: express-session + connect-pg-simple)
if (sessionMiddleware) {
  app.use(sessionMiddleware);
}

// --- Routes ---

// Health check (unauthenticated)
app.use('/api/health', healthRouter);

// Auth routes (TASK-003: register, TASK-004: login/logout, TASK-015: password reset)
app.use('/api/auth', authRouter);
// Note CRUD routes (ownership guard applied within the router)
app.use('/api/notes', notesRouter);
// Version history routes (ownership guard applied within the router)
// Mounted under /api/notes/:id so the note id param is available via mergeParams
app.use('/api/notes/:id', versionsRouter);
// Folder routes (ownership guard applied within the router)
app.use('/api/folders', foldersRouter);
// Full-text search routes (TASK-014)
app.use('/api/search', searchRouter);

// --- Static file serving (production) ---

if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'public');
  app.use(express.static(frontendDist));

  // SPA fallback: serve index.html for any non-API route
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// --- 404 handler for unmatched API routes ---

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `Cannot ${req.method} ${req.originalUrl}` });
});

// --- Centralised error handler ---

const ERROR_MAP = {
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  INVALID_TOKEN: 400,
  VALIDATION_ERROR: 400,
  VERSION_MISMATCH: 400,
  EMPTY_QUERY: 400,
  FOLDER_NOT_FOUND: 404,
};

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = ERROR_MAP[err.code] || ERROR_MAP[err.message] || 500;
  const message = err.message || 'Internal server error';

  if (status === 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({
    error: err.code || err.message || 'INTERNAL_ERROR',
    message,
  });
});

module.exports = app;
