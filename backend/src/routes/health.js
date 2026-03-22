/**
 * Health check route.
 *
 * Used by Docker, Watchtower, and Uptime Kuma to verify the application is
 * running and can reach the database (ADR-007, TASK-001 acceptance criterion 6).
 *
 * In non-test environments the response also includes basic Node.js process
 * statistics so that operators and Uptime Kuma can track memory trends without
 * additional tooling (TASK-032, AC-3).
 *
 * This route does NOT require authentication.
 */

'use strict';

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 *
 * Checks application liveness and database connectivity.
 *
 * @returns {200} { status: "ok", db: "connected" } -- application running and DB reachable
 *   In non-test environments, also includes:
 *   { process: { uptime_s, memory_rss_mb, node_version } }
 * @returns {503} { status: "error", db: "disconnected" } -- DB unreachable
 *
 * Preconditions: none (public endpoint)
 * Postconditions:
 *   - 200 response confirms the application process is alive and has a DB connection
 *   - 503 response indicates infrastructure-level problem; application is alive but degraded
 *   - process stats are omitted in test environment to avoid snapshot flakiness
 */
router.get('/', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    await sequelize.authenticate();

    const body = { status: 'ok', db: 'connected' };

    // Include process stats in all environments except test so that the
    // health endpoint doubles as a lightweight memory-trend gauge (TASK-032).
    if (process.env.NODE_ENV !== 'test') {
      const memBytes = process.memoryUsage().rss;
      body.process = {
        uptime_s: Math.floor(process.uptime()),
        memory_rss_mb: Math.round(memBytes / (1024 * 1024)),
        node_version: process.version,
      };
    }

    res.json(body);
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

module.exports = router;
