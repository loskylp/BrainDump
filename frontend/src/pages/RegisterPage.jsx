/**
 * RegisterPage component.
 *
 * Page wrapper for the registration flow. Renders RegisterForm and handles
 * post-registration navigation to the workspace.
 *
 * Route: /register (public)
 *
 * Navigation:
 *   - After successful registration: navigate to /workspace
 *     (session is established by the registration API call -- ADR-002)
 *   - "Already have an account? Log in" link: navigate to /login
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import RegisterForm from '../components/auth/RegisterForm.jsx';

/**
 * @returns {JSX.Element}
 *
 * @postcondition After successful registration: user is navigated to /workspace
 * @postcondition Page is accessible without authentication
 */
function RegisterPage() {
  const navigate = useNavigate();

  function handleSuccess() {
    navigate('/workspace');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-bg-primary p-8 rounded border border-border w-full max-w-md">
        <h1 className="text-2xl font-semibold text-text-primary mb-6 text-center">
          Create your account
        </h1>

        <div className="flex justify-center">
          <RegisterForm onSuccess={handleSuccess} />
        </div>

        <p className="text-text-secondary text-sm text-center mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:text-accent-hover underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
