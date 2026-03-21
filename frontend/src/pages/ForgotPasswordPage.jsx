/**
 * ForgotPasswordPage.
 *
 * Public page at route /forgot-password. Renders the ForgotPasswordForm
 * inside a centered card layout consistent with the Login and Register pages.
 *
 * This page is accessible without authentication. If the user is already
 * authenticated, they may still visit this page (no redirect enforced -- the
 * form is harmless when submitted by an authenticated user).
 *
 * Route: /forgot-password
 * Auth required: no
 */

import React from 'react';
import { Link } from 'react-router-dom';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm.jsx';

/**
 * @returns {JSX.Element}
 *
 * @postcondition Page is accessible without authentication
 */
function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-bg-primary p-8 rounded border border-border w-full max-w-md">
        <h1 className="text-2xl font-semibold text-text-primary mb-2 text-center">
          Reset your password
        </h1>
        <p className="text-text-secondary text-sm text-center mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <div className="flex justify-center">
          <ForgotPasswordForm />
        </div>

        <p className="text-text-secondary text-sm text-center mt-6">
          Remember your password?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
