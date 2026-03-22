/**
 * Rate limiter middleware factory.
 *
 * Provides pre-configured rate limiter instances for authentication endpoints
 * using express-rate-limit (ADR-002, TASK-024). Rate limiting is applied at
 * the application level as a defence against brute-force and credential
 * stuffing attacks on POST /api/auth/login and POST /api/auth/register.
 *
 * Store: in-memory (default express-rate-limit store). Acceptable for a
 * single-instance deployment per ADR-001. If BrainDump ever runs multiple
 * instances behind a load balancer, the store must be replaced with a shared
 * store (e.g., Redis or PostgreSQL-backed).
 *
 * Rate limit window: 15 minutes (per ADR-002 / SEC-001 finding).
 * Rate limit ceiling: 10 requests per window per IP.
 *
 * Headers returned on every response to a rate-limited route:
 *   RateLimit-Limit     -- ceiling for the window
 *   RateLimit-Remaining -- requests remaining in the current window
 *   RateLimit-Reset     -- UTC epoch seconds when the window resets
 *
 * The legacy X-RateLimit-* headers are disabled (standardHeaders: true,
 * legacyHeaders: false).
 *
 * @module rateLimiter
 */

'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for POST /api/auth/login and POST /api/auth/register.
 *
 * Configuration:
 *   windowMs        - 15 * 60 * 1000  (15-minute sliding window)
 *   max             - 10              (requests per window per IP)
 *   standardHeaders - true            (emit RateLimit-* headers per draft-7 spec)
 *   legacyHeaders   - false           (suppress X-RateLimit-* headers)
 *   keyGenerator    - (req) => req.ip (default IP-based keying)
 *   store           - default in-memory store (acceptable for single-instance
 *                     deployment per ADR-001; replace with a shared store if
 *                     multiple instances are ever deployed)
 *
 * On limit exceeded:
 *   HTTP 429 with body: { error: 'Too many requests, please try again later' }
 *
 * @precondition app.set('trust proxy', 1) is configured in app.js so that
 *               req.ip reflects the real client IP behind Traefik, not the
 *               load balancer's IP
 * @postcondition Requests beyond the ceiling within the window receive 429
 * @postcondition Requests within the ceiling pass through to the next middleware
 * @postcondition When NODE_ENV === 'test', all requests are passed through
 *               without counting (skip returns true), preventing cross-test
 *               interference in the acceptance and migration test suites
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  keyGenerator: (req) => req.ip,
  /**
   * Skip rate limiting entirely in test environments.
   *
   * Acceptance tests and the migration-test CI job make more than 10
   * POST /api/auth/register calls within the 15-minute window (multiple
   * test suites run sequentially against the same in-memory store). Without
   * this bypass, the shared limiter instance trips the ceiling mid-suite and
   * causes registration helpers to receive 429 instead of 201.
   *
   * Unit tests for rate-limit behaviour (rateLimiter.test.js) construct their
   * own fresh rateLimit() instances directly from express-rate-limit, so this
   * bypass does not affect coverage of the rate-limit logic itself.
   *
   * @returns {boolean} true when NODE_ENV is 'test', bypassing the limiter
   */
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * General-purpose rate limiter for write endpoints (tag creation, etc.).
 *
 * Configuration:
 *   windowMs - 15 * 60 * 1000  (15-minute sliding window)
 *   max      - 60              (60 requests per window per IP)
 *
 * More permissive than authRateLimiter — protects against automated bulk
 * creation without throttling normal interactive use.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  keyGenerator: (req) => req.ip,
  skip: () => process.env.NODE_ENV === 'test',
});

module.exports = { authRateLimiter, rateLimiter };
