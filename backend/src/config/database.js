/**
 * Sequelize configuration module.
 *
 * Reads POSTGRES_URL from the environment and constructs the Sequelize
 * connection options. Exports both the Sequelize instance (for application use)
 * and a CLI-compatible config object (for sequelize-cli migrations).
 *
 * Environment variables (see .env.example):
 *   POSTGRES_URL  -- Full PostgreSQL connection URL (required)
 *   NODE_ENV      -- Controls SQL query logging (development logs queries)
 *
 * Used by:
 *   - src/models/index.js (Sequelize instance)
 *   - .sequelizerc (migration CLI configuration)
 *   - src/middleware/rlsContext.js (raw DB queries for SET LOCAL)
 */

'use strict';

require('dotenv').config();

const { Sequelize } = require('sequelize');

const postgresUrl = process.env.POSTGRES_URL;

if (!postgresUrl) {
  throw new Error('POSTGRES_URL environment variable is required');
}

const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const sequelize = new Sequelize(postgresUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});

module.exports = sequelize;

// Sequelize CLI expects a plain config export when invoked via .sequelizerc.
// The CLI checks for module.exports.development / .test / .production.
// We export the URL-based config for all environments since POSTGRES_URL
// is the single source of truth.
module.exports.development = {
  url: postgresUrl,
  dialect: 'postgres',
};

module.exports.test = {
  url: process.env.POSTGRES_URL || 'postgresql://braindump_test:braindump_test@localhost:5432/braindump_test',
  dialect: 'postgres',
};

module.exports.production = {
  url: postgresUrl,
  dialect: 'postgres',
};

module.exports.staging = {
  url: postgresUrl,
  dialect: 'postgres',
};
