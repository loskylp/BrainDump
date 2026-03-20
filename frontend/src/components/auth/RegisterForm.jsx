/**
 * RegisterForm component.
 *
 * Controlled form component for the registration page. Performs client-side
 * validation (username non-empty, valid email format, password >= 8 chars)
 * before submitting to the API.
 *
 * Visual spec (ADR-008):
 *   - Same styling conventions as LoginForm
 *   - Professional/technical aesthetic with neutral palette
 *
 * Fields: username, email, password
 */

import React, { useState } from 'react';
import { register as registerApi } from '../../api/auth.js';

/**
 * Validates email format using a basic regex.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * @param {object} props
 * @param {function} props.onSuccess - Callback invoked with the user object after successful registration
 * @returns {JSX.Element}
 */
function RegisterForm({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validates all fields and returns an errors object.
   * @returns {object} Field-level errors (empty if valid)
   */
  function validate() {
    const newErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await registerApi({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      onSuccess(data.user);
    } catch (err) {
      if (err.status === 409 || err.error === 'EMAIL_TAKEN') {
        setServerError('An account with this email already exists');
      } else if (err.status === 400) {
        setServerError(err.message || 'Invalid input. Please check your details.');
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
          htmlFor="register-username"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Username
        </label>
        <input
          id="register-username"
          name="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'register-username-error' : undefined}
        />
        {errors.username && (
          <p id="register-username-error" className="text-error text-sm mt-1" role="alert">
            {errors.username}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="register-email"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Email
        </label>
        <input
          id="register-email"
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
          aria-describedby={errors.email ? 'register-email-error' : undefined}
        />
        {errors.email && (
          <p id="register-email-error" className="text-error text-sm mt-1" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="register-password"
          className="block text-sm font-medium text-text-primary mb-1"
        >
          Password
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
          }}
          className="w-full px-3 py-2 border border-border rounded text-text-primary bg-bg-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'register-password-error' : undefined}
        />
        {errors.password && (
          <p id="register-password-error" className="text-error text-sm mt-1" role="alert">
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
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}

export default RegisterForm;
