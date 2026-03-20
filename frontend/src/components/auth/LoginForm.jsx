/**
 * LoginForm component.
 *
 * Controlled form component for the login page. Performs client-side
 * validation (non-empty email with valid format, non-empty password) before
 * calling the login API. On 401, displays "Invalid email or password" without
 * revealing which field was wrong (no enumeration, ADR-002).
 *
 * Visual spec (ADR-008):
 *   - Labels: text-text-primary, font-weight 600 (font-medium), 14px (text-sm)
 *   - Inputs: border-border, bg-bg-primary, text-text-primary, 8px padding (py-2 px-3)
 *   - Submit button: bg-accent background, white text
 *   - Error messages: text-error color
 *   - No rounded corners > 4px
 */

import React, { useState } from 'react';
import { login as loginApi } from '../../api/auth.js';

/**
 * Validates email format using a basic regex.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates form fields and returns a field-level error object.
 * @param {string} email
 * @param {string} password
 * @returns {object} Field-level errors (empty object if all fields are valid)
 */
function validate(email, password) {
  const errors = {};

  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return errors;
}

/**
 * @param {object} props
 * @param {function} props.onSuccess - Callback invoked with the user object after successful login
 * @param {function} props.onForgotPassword - Callback invoked when user clicks "Forgot password?"
 * @returns {JSX.Element}
 *
 * @postcondition On submission with empty fields: client-side error is shown, no API call made
 * @postcondition On 401 response: "Invalid email or password" error shown (no field enumeration)
 * @postcondition On success: props.onSuccess({ id, username, email }) is called
 */
function LoginForm({ onSuccess, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate(email, password);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await loginApi(email.trim(), password);
      onSuccess(data.user);
    } catch (err) {
      if (err.status === 401 || err.error === 'INVALID_CREDENTIALS') {
        setServerError('Invalid email or password');
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 w-full max-w-sm">
      <div>
        <label
          htmlFor="login-email"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
        />
        {errors.email && (
          <p id="login-email-error" className="text-error text-sm mt-1" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="login-password"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
        />
        {errors.password && (
          <p id="login-password-error" className="text-error text-sm mt-1" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      {serverError && (
        <p className="text-error text-sm" role="alert" data-testid="server-error">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2 px-4 bg-accent text-white font-medium rounded hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </button>

      <p className="text-text-secondary text-sm text-center">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-accent hover:text-accent-hover underline bg-transparent border-none cursor-pointer p-0"
        >
          Forgot password?
        </button>
      </p>
    </form>
  );
}

export default LoginForm;
