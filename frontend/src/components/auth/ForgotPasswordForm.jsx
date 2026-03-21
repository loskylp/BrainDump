/**
 * ForgotPasswordForm component.
 *
 * Renders a single-field form that accepts an email address and calls
 * the forgotPassword API function. Displays the same success message
 * regardless of whether the email is registered, preventing user
 * enumeration (ADR-002, REQ-003).
 *
 * Visual state machine:
 *   idle      -> form visible, submit button enabled
 *   loading   -> submit button disabled with loading indicator
 *   success   -> form hidden, success message shown
 *   error     -> inline error message shown, form remains visible
 *
 * Props: none (self-contained form)
 *
 * After a successful submission the component transitions to the success
 * state and does NOT redirect automatically -- the user must wait for the
 * email and follow the link themselves.
 */

import React, { useState } from 'react';
import { forgotPassword } from '../../api/auth.js';

/**
 * Validates that the email field is non-empty.
 *
 * @param {string} email
 * @returns {string|null} Error message, or null if valid
 */
function validateEmail(email) {
  if (!email || email.trim().length === 0) {
    return 'Email is required';
  }
  return null;
}

/**
 * @returns {JSX.Element}
 *
 * @postcondition On success: success message is shown; form is hidden
 * @postcondition On error: error alert is shown; form remains visible
 * @postcondition API is never called when email validation fails
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [fieldError, setFieldError] = useState(null);
  const [serverError, setServerError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const validationError = validateEmail(email);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(null);
    setStatus('loading');

    try {
      await forgotPassword(email.trim());
      setStatus('success');
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="w-full max-w-sm text-center" role="status">
        <p className="text-text-primary font-medium">
          Check your email for a reset link.
        </p>
        <p className="text-text-secondary text-sm mt-2">
          If an account exists for that email, a password reset link has been sent.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full max-w-sm">
      <div>
        <label
          htmlFor="forgot-email"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? 'forgot-email-error' : undefined}
        />
        {fieldError && (
          <p id="forgot-email-error" className="text-error text-sm mt-1" role="alert">
            {fieldError}
          </p>
        )}
      </div>

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
        {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
      </button>
    </form>
  );
}
