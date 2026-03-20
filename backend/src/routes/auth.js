/**
 * Authentication routes.
 *
 * Handles user registration, login, logout, and password reset. No
 * authentication middleware is applied to these routes (they are the entry
 * point for unauthenticated users). CSRF protection is provided by the
 * sameSite: strict cookie configuration (ADR-002).
 *
 * All routes delegate business logic to authService.
 */

'use strict';

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { User } = require('../models');

/**
 * POST /api/auth/register
 *
 * Creates a new user account and establishes a session.
 *
 * Request body:
 *   { username: string, email: string, password: string }
 *
 * @returns {201} { user: { id, username, email } } -- account created, session established
 * @returns {400} { error: "VALIDATION_ERROR", message: string } -- invalid input
 * @returns {409} { error: "EMAIL_TAKEN" } -- email already registered
 *
 * Postconditions:
 *   - On 201: req.session.userId is set to the new user's UUID
 *   - On 201: session cookie is set in the response
 *   - Password minimum length of 8 characters is validated server-side
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const user = await authService.register({ username, email, password });

    // Establish session (ADR-002)
    req.session.userId = user.id;

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile, or 401 if no session
 * is active. Used by the frontend useAuth hook to check session state on mount.
 *
 * @returns {200} { user: { id, username, email } } -- session is active
 * @returns {401} { error: "Authentication required" } -- no active session
 *
 * Postconditions:
 *   - Does not modify session state
 *   - Returns 401 without leaking user existence details for unauthenticated requests
 */
router.get('/me', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findByPk(req.session.userId);
    if (!user) {
      // Session references a deleted user -- clear the stale session
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Authentication required' });
    }

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 *
 * Authenticates an existing user and establishes a session.
 *
 * Request body:
 *   { email: string, password: string }
 *
 * @returns {200} { user: { id, username, email } } -- login successful
 * @returns {401} { error: "INVALID_CREDENTIALS" } -- wrong email or password
 *
 * Postconditions:
 *   - On 200: req.session.userId is set to the authenticated user's UUID
 *   - On 200: session cookie is set in the response with 7-day rolling expiry
 *   - Error message does not reveal which field was incorrect (no enumeration)
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.login(email, password);

    // Establish session (ADR-002)
    req.session.userId = user.id;

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 *
 * Destroys the current session.
 *
 * No request body required.
 *
 * @returns {200} { message: "Logged out" }
 *
 * Postconditions:
 *   - Session row is deleted from the PostgreSQL session store
 *   - Response clears the session cookie
 *   - Subsequent requests with the old cookie return 401
 */
router.post('/logout', async (req, res, next) => {
  try {
    await authService.logout(req.session);

    // Clear the session cookie from the client
    res.clearCookie('connect.sid', {
      httpOnly: true,
      sameSite: 'strict',
    });

    res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/forgot-password
 *
 * Initiates the password reset flow for the given email address.
 *
 * Request body:
 *   { email: string }
 *
 * @returns {200} { message: "If that email is registered, a reset link has been sent." }
 *   NOTE: This response is IDENTICAL regardless of whether the email is registered.
 *   This prevents user enumeration (REQ-003, ADR-002).
 *
 * Postconditions:
 *   - If email is registered: password_reset_tokens row created, email sent via emailService
 *   - If email is not registered: no side effects, same response
 *   - Response time is similar for both cases (no timing-based enumeration)
 */
router.post('/forgot-password', async (req, res, next) => {
  // TODO: TASK-015 -- implement
  next(new Error('Not implemented'));
});

/**
 * POST /api/auth/reset-password
 *
 * Completes the password reset using a valid token from the email link.
 *
 * Request body:
 *   { token: string, newPassword: string }
 *
 * @returns {200} { message: "Password updated successfully" }
 * @returns {400} { error: "INVALID_TOKEN" } -- token not found, expired, or already used
 * @returns {400} { error: "VALIDATION_ERROR", message: string } -- newPassword too short
 *
 * Postconditions:
 *   - On 200: user's password_hash updated with bcrypt hash of newPassword
 *   - On 200: used token row deleted
 *   - On 200: all existing sessions for the user invalidated
 */
router.post('/reset-password', async (req, res, next) => {
  // TODO: TASK-015 -- implement
  next(new Error('Not implemented'));
});

module.exports = router;
