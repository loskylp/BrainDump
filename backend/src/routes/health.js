/**
 * Health check route.
 *
 * Used by Docker, Watchtower, and Uptime Kuma to verify the application is
 * running and can reach the database (ADR-007, TASK-001 acceptance criterion 6).
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
 * @returns {503} { status: "error", db: "disconnected" } -- DB unreachable
 *
 * Preconditions: none (public endpoint)
 * Postconditions:
 *   - 200 response confirms the application process is alive and has a DB connection
 *   - 503 response indicates infrastructure-level problem; application is alive but degraded
 */
router.get('/', async (req, res) => {
  try {
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

module.exports = router;
