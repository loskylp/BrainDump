/**
 * Authentication service.
 *
 * Encapsulates all authentication business logic: registration, login,
 * logout, and password reset flows. Route handlers delegate to this service
 * and transform the return values into HTTP responses.
 */

'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, sequelize } = require('../models');
const emailService = require('./emailService');

/**
 * Registers a new user account.
 *
 * @param {object} params
 * @param {string} params.username - Display name (non-empty, max 50 chars)
 * @param {string} params.email - Login email (valid format, unique in database)
 * @param {string} params.password - Plaintext password (min 8 chars)
 * @returns {Promise<User>} The created User model instance (password_hash excluded)
 * @throws {Error} With message 'EMAIL_TAKEN' if the email is already registered
 * @throws {Error} With message 'VALIDATION_ERROR' if inputs fail validation
 *
 * @precondition password.length >= 8
 * @precondition email is a well-formed email address
 * @postcondition User row is persisted with bcrypt-hashed password (cost factor 12)
 * @postcondition Plaintext password is never stored or returned
 */
async function register({ username, email, password }) {
  // Validate inputs
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    const err = new Error('Username is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    const err = new Error('Email is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    const err = new Error('Invalid email format');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (username.trim().length > 50) {
    const err = new Error('Username must be 50 characters or fewer');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Hash password with bcryptjs, cost factor 12 (ADR-002)
  const password_hash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
    });

    // Return user without password_hash (toJSON() already excludes it)
    return user;
  } catch (error) {
    // Handle unique constraint violation on email
    if (error.name === 'SequelizeUniqueConstraintError') {
      const err = new Error('EMAIL_TAKEN');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
    throw error;
  }
}

/**
 * Authenticates a user by email and password.
 *
 * Looks up the user by normalized (lowercased, trimmed) email, then calls
 * user.comparePassword(). Both "email not found" and "wrong password" cases
 * throw an INVALID_CREDENTIALS error with an identical message to prevent
 * user enumeration (ADR-002, REQ-002).
 *
 * @param {string} email - The user's email address
 * @param {string} password - The plaintext password to verify
 * @returns {Promise<User>} The authenticated User instance (password_hash excluded via toJSON)
 * @throws {Error} code='VALIDATION_ERROR' if email or password is empty
 * @throws {Error} code='INVALID_CREDENTIALS' if email not found or password wrong
 *
 * @precondition Neither email nor password is empty
 * @postcondition On success: returned User has id, username, email (no password_hash)
 * @postcondition Failed attempt does NOT reveal which field was incorrect
 */
async function login(email, password) {
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    const err = new Error('Email is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    const err = new Error('Password is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const user = await User.findOne({
    where: { email: email.trim().toLowerCase() },
  });

  // Use a consistent error regardless of which field is wrong (no enumeration)
  const invalidCredentials = () => {
    const err = new Error('Invalid email or password');
    err.code = 'INVALID_CREDENTIALS';
    return err;
  };

  if (!user) {
    throw invalidCredentials();
  }

  const passwordMatches = await user.comparePassword(password);
  if (!passwordMatches) {
    throw invalidCredentials();
  }

  return user;
}

/**
 * Destroys the express-session, deleting its row from the PostgreSQL session store.
 *
 * Wraps session.destroy() in a Promise so callers can await it. After this call,
 * any subsequent request presenting the destroyed session ID will receive a fresh,
 * unauthenticated session.
 *
 * @param {import('express-session').Session} session - The express-session object from req.session
 * @returns {Promise<void>}
 * @throws {Error} If session.destroy() passes an error to its callback
 *
 * @postcondition Session row is deleted from the PostgreSQL session store
 * @postcondition The destroyed session ID is no longer valid for authentication
 */
async function logout(session) {
  return new Promise((resolve, reject) => {
    session.destroy((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Initiates the password reset flow for the given email address.
 *
 * Generates a secure random token, stores its hash in password_reset_tokens,
 * and sends the reset URL via emailService. The response to the caller is
 * identical regardless of whether the email is registered (prevents user
 * enumeration, ADR-002 and REQ-003).
 *
 * @param {string} email - The email address submitted via the forgot-password form
 * @param {string} appUrl - Base URL for constructing the reset link (from APP_URL env)
 * @returns {Promise<void>}
 *
 * @postcondition If email is registered: token_hash row created, reset email sent
 * @postcondition If email is not registered: no side effects, same call duration
 * @postcondition Raw token is never stored -- only the hash is persisted
 */
async function forgotPassword(email, frontendUrl) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ where: { email: normalizedEmail } });

  // Always take the same code path to avoid timing-based user enumeration (ADR-002)
  if (!user) {
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Delete any existing reset tokens for this user (one active token per user)
  await sequelize.query(
    'DELETE FROM password_reset_tokens WHERE user_id = :userId',
    { replacements: { userId: user.id } }
  );

  // Store hashed token — raw token is never persisted (ADR-002)
  await sequelize.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
     VALUES (gen_random_uuid(), :userId, :tokenHash, :expiresAt, NOW())`,
    { replacements: { userId: user.id, tokenHash: tokenHash, expiresAt: expiresAt } }
  );

  const baseUrl = frontendUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  await emailService.sendPasswordResetEmail(normalizedEmail, resetUrl);
}

/**
 * Completes the password reset using a valid reset token.
 *
 * Looks up the token hash, verifies it is not expired, updates the user's
 * password, deletes the token row, and invalidates all existing sessions for
 * that user.
 *
 * @param {string} token - The raw reset token from the email link
 * @param {string} newPassword - The new plaintext password (min 8 chars)
 * @returns {Promise<void>}
 * @throws {Error} With message 'INVALID_TOKEN' if token not found or expired
 * @throws {Error} With message 'VALIDATION_ERROR' if newPassword.length < 8
 *
 * @precondition newPassword.length >= 8
 * @postcondition User's password_hash is updated with bcrypt hash of newPassword
 * @postcondition The used token row is deleted (cannot be reused)
 * @postcondition All existing sessions for the user are invalidated (DELETE from session table)
 */
async function resetPassword(token, newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    const err = new Error('Password must be at least 8 characters');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Look up valid (non-expired) token by hash
  const [rows] = await sequelize.query(
    `SELECT user_id, expires_at FROM password_reset_tokens
     WHERE token_hash = :tokenHash AND expires_at > NOW()`,
    { replacements: { tokenHash: tokenHash } }
  );

  if (!rows || rows.length === 0) {
    const err = new Error('Invalid or expired reset token');
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const tokenRow = rows[0];
  const userId = tokenRow.user_id;

  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update user's password
  await sequelize.query(
    'UPDATE users SET password_hash = :passwordHash, updated_at = NOW() WHERE id = :userId',
    { replacements: { passwordHash: passwordHash, userId: userId } }
  );

  // Delete the used token (invalidate so it cannot be reused)
  await sequelize.query(
    'DELETE FROM password_reset_tokens WHERE token_hash = :tokenHash',
    { replacements: { tokenHash: tokenHash } }
  );

  // Invalidate all sessions for this user
  await sequelize.query(
    `DELETE FROM session WHERE sess->>'userId' = :userId`,
    { replacements: { userId: userId } }
  );
}

module.exports = { register, login, logout, forgotPassword, resetPassword };
