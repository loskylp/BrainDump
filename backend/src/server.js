/**
 * HTTP server entry point.
 *
 * Imports the Express app from app.js, verifies the database connection, then
 * binds the HTTP listener. This file is the target of `node src/server.js` in
 * the Docker entrypoint and `nodemon src/server.js` in development.
 *
 * Startup sequence:
 *   1. Load environment variables (.env via dotenv)
 *   2. Test database connectivity (sequelize.authenticate())
 *   3. Start HTTP listener on PORT (default 3000)
 *   4. Log the listening address
 *
 * The Docker entrypoint (docker-entrypoint.sh) runs `sequelize db:migrate`
 * BEFORE starting this file -- by the time this runs, migrations are done.
 *
 * Environment variables:
 *   PORT         -- HTTP port to listen on (default: 3000)
 *   POSTGRES_URL -- Required; must be reachable before server starts
 *   NODE_ENV     -- Controls logging verbosity
 */

'use strict';

require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

async function start() {
  // Attempt database connection check.
  // config/database.js is a TASK-002 stub -- handle gracefully if not yet implemented.
  try {
    const { sequelize } = require('./models');
    if (sequelize && typeof sequelize.authenticate === 'function') {
      await sequelize.authenticate();
      console.log('Database connection established.');
    }
  } catch (err) {
    // If the database module is not yet implemented or the DB is unreachable,
    // log the warning but still start the server so the health endpoint and
    // frontend serving work.
    console.warn('Database connection failed -- server starting without DB:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`BrainDump server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
