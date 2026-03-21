/**
 * Unit tests for the password reset route handlers (TASK-015).
 *
 * Tests:
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 *
 * authService is mocked — no database required. A minimal Express app
 * mounts only the auth router, matching the pattern used by other route
 * unit tests in this suite.
 *
 * REQ-003 (Password reset), ADR-002 (no user enumeration)
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Mock authService before importing the router
// ---------------------------------------------------------------------------

jest.mock('../../src/services/authService', () => ({
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn().mockResolvedValue(undefined),
  resetPassword: jest.fn().mockResolvedValue(undefined),
}));

// Mock rateLimiter to pass-through in tests
jest.mock('../../src/middleware/rateLimiter', () => ({
  authRateLimiter: jest.fn((_req, _res, next) => next()),
}));

// Mock models/User (imported directly in auth route for /me and /logout)
jest.mock('../../src/models', () => ({
  User: { findByPk: jest.fn() },
  sequelize: { query: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const authRouter = require('../../src/routes/auth');
const authService = require('../../src/services/authService');

// ---------------------------------------------------------------------------
// Error codes mapped to HTTP status
// ---------------------------------------------------------------------------

const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  INVALID_TOKEN: 400,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
};

/**
 * Builds a minimal Express app mounting the auth router with an error handler
 * that maps service error codes to HTTP status codes.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  // Mirror the error handler logic from src/app.js
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = ERROR_STATUS[err.code] || ERROR_STATUS[err.message] || 500;
    res.status(status).json({
      error: err.code || err.message || 'INTERNAL_ERROR',
      message: err.message,
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/forgot-password
// ---------------------------------------------------------------------------

describe('POST /api/auth/forgot-password', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    authService.forgotPassword.mockResolvedValue(undefined);
    app = buildApp();
  });

  it('returns 200 with success message for a registered email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link has been sent/i);
  });

  it('returns 200 with the same success message for an unregistered email (no user enumeration)', async () => {
    // forgotPassword returns undefined for both registered and unregistered emails
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link has been sent/i);
  });

  it('returns 400 when email is missing from request body', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(authService.forgotPassword).not.toHaveBeenCalled();
  });

  it('calls authService.forgotPassword with the provided email', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(authService.forgotPassword).toHaveBeenCalledWith('alice@example.com');
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/auth/reset-password
// ---------------------------------------------------------------------------

describe('POST /api/auth/reset-password', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    authService.resetPassword.mockResolvedValue(undefined);
    app = buildApp();
  });

  it('returns 200 with a valid token and password', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'validtoken', password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset/i);
  });

  it('returns 400 INVALID_TOKEN when authService throws INVALID_TOKEN', async () => {
    const err = new Error('Invalid or expired reset token');
    err.code = 'INVALID_TOKEN';
    authService.resetPassword.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'expiredtoken', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('returns 400 INVALID_TOKEN for an expired token', async () => {
    const err = new Error('Invalid or expired reset token');
    err.code = 'INVALID_TOKEN';
    authService.resetPassword.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'expiredtoken', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('returns 400 INVALID_TOKEN for a previously used (deleted) token', async () => {
    const err = new Error('Invalid or expired reset token');
    err.code = 'INVALID_TOKEN';
    authService.resetPassword.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'usedtoken', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('returns 400 VALIDATION_ERROR for a password shorter than 8 characters', async () => {
    const err = new Error('Password must be at least 8 characters');
    err.code = 'VALIDATION_ERROR';
    authService.resetPassword.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'validtoken', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_TOKEN for an unknown (never-issued) token', async () => {
    const err = new Error('Invalid or expired reset token');
    err.code = 'INVALID_TOKEN';
    authService.resetPassword.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'unknowntoken', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_TOKEN');
  });

  it('returns 400 when token is missing from request body', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('returns 400 when password is missing from request body', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'sometoken' });

    expect(res.status).toBe(400);
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });
});
