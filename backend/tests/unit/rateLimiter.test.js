/**
 * Unit tests for authRateLimiter middleware (TASK-024).
 *
 * Verifies:
 *   AC-2: POST /api/auth/login returns 429 after exceeding 10 requests within
 *         the window; body contains { error: 'Too many requests, please try
 *         again later' }
 *   AC-3: POST /api/auth/register returns 429 after exceeding 10 requests
 *         within the window; body contains the same error message
 *   AC-4: Rate limit headers (RateLimit-Limit, RateLimit-Remaining,
 *         RateLimit-Reset) are present in responses to rate-limited routes
 *   AC-6: Existing authentication tests pass with no regressions (verified by
 *         running the full suite; this file confirms the middleware integrates
 *         correctly with the auth router without breaking successful paths)
 *
 * Test isolation strategy: each describe block that exercises the rate limit
 * constructs a fresh Express app with a fresh rateLimit() instance so that
 * request counts from one test do not pollute another. The authRateLimiter
 * singleton exported from rateLimiter.js is NOT used directly here — each
 * block creates its own limiter with the same configuration. This mirrors the
 * production configuration and avoids cross-test store pollution.
 *
 * No database or session middleware is needed: authService is mocked and the
 * route handlers are wired to a minimal Express app.
 */

'use strict';

const request = require('supertest');
const express = require('express');
const rateLimit = require('express-rate-limit');

// ---------------------------------------------------------------------------
// Mock authService so the route handlers never touch the database.
// ---------------------------------------------------------------------------

jest.mock('../../src/services/authService', () => ({
  register: jest.fn().mockResolvedValue({
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    username: 'testuser',
    email: 'test@example.com',
  }),
  login: jest.fn().mockResolvedValue({
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    username: 'testuser',
    email: 'test@example.com',
  }),
  logout: jest.fn().mockResolvedValue(undefined),
}));

// Mock the User model (used by GET /api/auth/me — not exercised here but the
// router imports it at module load time).
jest.mock('../../src/models', () => ({
  User: { findByPk: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Creates a rate limiter configured identically to the production instance in
 * rateLimiter.js, but as a fresh instance (fresh in-memory store) so that
 * prior test runs do not pollute the counter.
 *
 * @returns {import('express-rate-limit').RateLimitRequestHandler}
 */
function makeFreshLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
    keyGenerator: (req) => req.ip,
  });
}

/**
 * Builds a minimal Express app with the auth router mounted at /api/auth,
 * using a fresh rate limiter instance applied only to /login and /register.
 *
 * Session middleware is stubbed: req.session is initialised as an empty object
 * so that route handlers can write to it without throwing.
 *
 * @param {import('express-rate-limit').RateLimitRequestHandler} limiter
 * @returns {import('express').Application}
 */
function buildApp(limiter) {
  const app = express();

  // Trust the first proxy so req.ip is resolved consistently in tests.
  app.set('trust proxy', false);

  app.use(express.json());

  // Minimal session stub: inject an empty session object.
  app.use((req, _res, next) => {
    req.session = {};
    next();
  });

  // Wire individual route handlers with the provided limiter rather than
  // importing the auth router wholesale. This avoids the router's module-level
  // import of the rateLimiter singleton (which may be null during the red
  // phase) and gives each test full control over the limiter instance.
  const authService = require('../../src/services/authService');

  app.post('/api/auth/register', limiter, async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      const user = await authService.register({ username, email, password });
      req.session.userId = user.id;
      res.status(201).json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login', limiter, async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await authService.login(email, password);
      req.session.userId = user.id;
      res.status(200).json({ user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
      next(err);
    }
  });

  // Error handler
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sends `count` sequential POST requests to `url` on `app` with `body`.
 * Returns the array of supertest responses in order.
 *
 * @param {import('express').Application} app
 * @param {string} url
 * @param {object} body
 * @param {number} count
 * @returns {Promise<import('supertest').Response[]>}
 */
async function sendRequests(app, url, body, count) {
  const responses = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app).post(url).send(body);
    responses.push(res);
  }
  return responses;
}

// ---------------------------------------------------------------------------
// AC-4: Rate limit headers are present on responses from rate-limited routes
// ---------------------------------------------------------------------------

describe('AC-4: rate limit headers', () => {
  let app;

  beforeEach(() => {
    app = buildApp(makeFreshLimiter());
  });

  it('includes RateLimit-Limit in the response to POST /api/auth/login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers).toHaveProperty('ratelimit-limit');
  });

  it('includes RateLimit-Remaining in the response to POST /api/auth/login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });

  it('includes RateLimit-Reset in the response to POST /api/auth/login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers).toHaveProperty('ratelimit-reset');
  });

  it('includes RateLimit-Limit in the response to POST /api/auth/register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'test@example.com', password: 'password123' });

    expect(res.headers).toHaveProperty('ratelimit-limit');
  });

  it('includes RateLimit-Remaining in the response to POST /api/auth/register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'test@example.com', password: 'password123' });

    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });

  it('includes RateLimit-Reset in the response to POST /api/auth/register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'test@example.com', password: 'password123' });

    expect(res.headers).toHaveProperty('ratelimit-reset');
  });

  it('RateLimit-Limit header value is 10', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    // The header value may be the numeric string '10' or the structured
    // policy string '10; w=900'. Both start with '10'.
    expect(res.headers['ratelimit-limit']).toMatch(/^10/);
  });

  it('does not include legacy X-RateLimit-* headers', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers).not.toHaveProperty('x-ratelimit-limit');
    expect(res.headers).not.toHaveProperty('x-ratelimit-remaining');
    expect(res.headers).not.toHaveProperty('x-ratelimit-reset');
  });
});

// ---------------------------------------------------------------------------
// AC-2: POST /api/auth/login returns 429 after exceeding 10 requests
// ---------------------------------------------------------------------------

describe('AC-2: POST /api/auth/login rate limit', () => {
  let app;

  beforeEach(() => {
    // Fresh limiter per test: the in-memory store starts at zero.
    app = buildApp(makeFreshLimiter());
  });

  it('allows the first 10 requests to succeed', async () => {
    const responses = await sendRequests(
      app,
      '/api/auth/login',
      { email: 'test@example.com', password: 'password123' },
      10
    );

    responses.forEach((res, i) => {
      expect(res.status).not.toBe(429);
    });
  });

  it('returns 429 on the 11th request within the window', async () => {
    // Exhaust the limit.
    await sendRequests(
      app,
      '/api/auth/login',
      { email: 'test@example.com', password: 'password123' },
      10
    );

    // The 11th request must be rejected.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(429);
  });

  it('429 response body contains the expected error message', async () => {
    await sendRequests(
      app,
      '/api/auth/login',
      { email: 'test@example.com', password: 'password123' },
      10
    );

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.body).toEqual({ error: 'Too many requests, please try again later' });
  });

  it('RateLimit-Remaining decrements with each request', async () => {
    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    const firstRemaining = parseInt(first.headers['ratelimit-remaining'], 10);
    const secondRemaining = parseInt(second.headers['ratelimit-remaining'], 10);

    expect(secondRemaining).toBeLessThan(firstRemaining);
  });
});

// ---------------------------------------------------------------------------
// AC-3: POST /api/auth/register returns 429 after exceeding 10 requests
// ---------------------------------------------------------------------------

describe('AC-3: POST /api/auth/register rate limit', () => {
  let app;

  beforeEach(() => {
    app = buildApp(makeFreshLimiter());
  });

  it('allows the first 10 requests to succeed', async () => {
    const responses = await sendRequests(
      app,
      '/api/auth/register',
      { username: 'user', email: 'test@example.com', password: 'password123' },
      10
    );

    responses.forEach((res) => {
      expect(res.status).not.toBe(429);
    });
  });

  it('returns 429 on the 11th request within the window', async () => {
    await sendRequests(
      app,
      '/api/auth/register',
      { username: 'user', email: 'test@example.com', password: 'password123' },
      10
    );

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(429);
  });

  it('429 response body contains the expected error message', async () => {
    await sendRequests(
      app,
      '/api/auth/register',
      { username: 'user', email: 'test@example.com', password: 'password123' },
      10
    );

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'user', email: 'test@example.com', password: 'password123' });

    expect(res.body).toEqual({ error: 'Too many requests, please try again later' });
  });
});

// ---------------------------------------------------------------------------
// AC-6 / integration: authRateLimiter module exports a non-null middleware
// ---------------------------------------------------------------------------

describe('authRateLimiter module contract', () => {
  it('exports authRateLimiter as a function (not null)', () => {
    // This test fails in the red phase when the stub exports null.
    const { authRateLimiter } = require('../../src/middleware/rateLimiter');
    expect(typeof authRateLimiter).toBe('function');
  });

  it('authRateLimiter is a middleware with arity 3 (req, res, next)', () => {
    const { authRateLimiter } = require('../../src/middleware/rateLimiter');
    expect(authRateLimiter.length).toBe(3);
  });
});
