/**
 * Authentication API module.
 *
 * Client-side functions for all authentication endpoints. Each function
 * corresponds to one backend route in src/routes/auth.js.
 */

import { post, apiRequest } from './client.js';

/**
 * Registers a new user account.
 *
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ user: { id: string, username: string, email: string } }>}
 * @throws {ApiError} 409 if email is already registered
 * @throws {ApiError} 400 if validation fails
 */
export async function register({ username, email, password }) {
  return post('/api/auth/register', { username, email, password });
}

/**
 * Authenticates an existing user.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ user: { id: string, username: string, email: string } }>}
 * @throws {ApiError} 401 if credentials are invalid
 */
export async function login(email, password) {
  return post('/api/auth/login', { email, password });
}

/**
 * Destroys the current session.
 *
 * @returns {Promise<{ message: string }>}
 */
export async function logout() {
  return post('/api/auth/logout');
}

/**
 * Requests a password reset email.
 *
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 *   NOTE: Always returns 200 regardless of whether the email is registered.
 */
export async function forgotPassword(email) {
  return post('/api/auth/forgot-password', { email });
}

/**
 * Completes the password reset flow.
 *
 * @param {string} token - Raw reset token from the email link
 * @param {string} newPassword - New plaintext password (min 8 chars)
 * @returns {Promise<{ message: string }>}
 * @throws {ApiError} 400 if token is invalid, expired, or newPassword is too short
 */
export async function resetPassword(token, newPassword) {
  return post('/api/auth/reset-password', { token, password: newPassword });
}

/**
 * Permanently deletes the authenticated user's account.
 *
 * The user must supply their current password as confirmation. The server
 * validates the password before deleting the account and all associated data
 * (notes, versions, folders, reset tokens, sessions) via CASCADE (ADR-003).
 *
 * @param {string} password - Current plaintext password for confirmation
 * @returns {Promise<{ message: string }>}
 * @throws {ApiError} 401 if the password does not match
 * @throws {ApiError} 401 if the session is not active
 */
export async function deleteAccount(password) {
  // TODO: TASK-019 -- implement:
  // del() has no body param; use apiRequest directly:
  // return apiRequest('/api/auth/account', { method: 'DELETE', body: { password } });
  throw new Error('Not implemented');
}
