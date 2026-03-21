/**
 * ResetPasswordForm component.
 *
 * Renders a form that accepts a new password and a confirmation field. The
 * raw reset token is read from the URL search params (?token=<rawToken>) and
 * passed directly to the resetPassword API call. The token itself is never
 * displayed to the user.
 *
 * Visual state machine:
 *   no-token  -> error state with link to /forgot-password (token missing from URL)
 *   idle      -> form visible, submit enabled
 *   loading   -> submit disabled with loading indicator
 *   success   -> form hidden, success message with link to /login
 *   error     -> inline error shown (token expired/invalid, password too short)
 *
 * Props: none (reads token from URL via useSearchParams)
 *
 * Preconditions:
 *   - URL contains a non-empty ?token= query parameter (enforced at render time)
 *   - If token is missing, error state is rendered immediately without API call
 *
 * Postconditions on success:
 *   - User's password is updated server-side
 *   - All existing sessions for the user are invalidated server-side
 *   - Component shows a success message directing the user to log in
 */

import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api/auth.js';

/**
 * Validates the password fields before submission.
 *
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {string|null} Error message, or null if valid
 */
function validatePasswords(password, confirmPassword) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return null;
}

/**
 * @returns {JSX.Element}
 *
 * @postcondition If no token in URL: error state with link to /forgot-password
 * @postcondition On validation failure: error message shown, API not called
 * @postcondition On success: success message with login link shown
 * @postcondition On API error: error alert shown, form remains visible
 */
export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [validationError, setValidationError] = useState(null);
  const [serverError, setServerError] = useState('');

  // Guard: show error state immediately if token is missing
  if (!token) {
    return (
      <div className="w-full max-w-sm text-center space-y-4">
        <p className="text-error font-medium">
          Invalid or missing reset link. Please request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="text-accent hover:text-accent-hover underline text-sm"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const error = validatePasswords(password, confirmPassword);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setStatus('loading');

    try {
      await resetPassword(token, password);
      setStatus('success');
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-sm text-center space-y-4" role="status">
        <p className="text-text-primary font-medium">
          Your password has been reset successfully.
        </p>
        <Link
          to="/login"
          className="text-accent hover:text-accent-hover underline text-sm"
        >
          Log in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full max-w-sm">
      <div>
        <label
          htmlFor="reset-password"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          New Password
        </label>
        <input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (validationError) setValidationError(null);
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label
          htmlFor="reset-confirm-password"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Confirm Password
        </label>
        <input
          id="reset-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (validationError) setValidationError(null);
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {validationError && (
        <p className="text-error text-sm" role="alert">
          {validationError}
        </p>
      )}

      {serverError && (
        <p className="text-error text-sm" role="alert">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full py-2 px-4 bg-accent text-white font-medium rounded hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}
