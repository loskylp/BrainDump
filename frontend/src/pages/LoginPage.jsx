/**
 * LoginPage component.
 *
 * Page wrapper for the login flow. Renders LoginForm centered on the page
 * and handles post-login navigation to the workspace.
 *
 * Route: /login (public)
 *
 * Navigation:
 *   - After successful login: navigate to /workspace
 *   - "Forgot password?" link: navigate to /forgot-password (TASK-015)
 *   - "Create account" link: navigate to /register
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm.jsx';

/**
 * @returns {JSX.Element}
 *
 * @postcondition After successful login: user is navigated to /workspace
 * @postcondition Page is accessible without authentication
 */
function LoginPage() {
  const navigate = useNavigate();

  function handleSuccess() {
    navigate('/workspace');
  }

  function handleForgotPassword() {
    navigate('/forgot-password');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-bg-primary p-8 rounded border border-border w-full max-w-md">
        <h1 className="text-2xl font-semibold text-text-primary mb-6 text-center">
          Log in to BrainDump
        </h1>

        <div className="flex justify-center">
          <LoginForm onSuccess={handleSuccess} onForgotPassword={handleForgotPassword} />
        </div>

        <p className="text-text-secondary text-sm text-center mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-accent hover:text-accent-hover underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
