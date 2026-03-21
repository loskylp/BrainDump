/**
 * ResetPasswordPage.
 *
 * Public page at route /reset-password. Renders the ResetPasswordForm which
 * reads the raw reset token from the URL query string (?token=<rawToken>).
 *
 * This page is the landing destination of the link inside the password reset
 * email. It must be accessible without authentication.
 *
 * Route: /reset-password?token=<rawToken>
 * Auth required: no
 */

import React from 'react';
import ResetPasswordForm from '../components/auth/ResetPasswordForm.jsx';

/**
 * @returns {JSX.Element}
 *
 * @postcondition Page is accessible without authentication
 * @postcondition ResetPasswordForm handles the missing-token error state internally
 */
function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-bg-primary p-8 rounded border border-border w-full max-w-md">
        <h1 className="text-2xl font-semibold text-text-primary mb-6 text-center">
          Set a new password
        </h1>

        <div className="flex justify-center">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
