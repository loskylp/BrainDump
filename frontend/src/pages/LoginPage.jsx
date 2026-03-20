/**
 * LoginPage component.
 *
 * Page wrapper for the login flow. Renders LoginForm and handles post-login
 * navigation to the workspace.
 *
 * Route: /login (public)
 *
 * Navigation:
 *   - After successful login: navigate to /workspace
 *   - "Forgot password?" link: navigate to /forgot-password (TASK-015)
 *   - "Create account" link: navigate to /register
 */

// TODO: TASK-004
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
  // TODO: TASK-004 -- implement page shell, pass navigation callbacks to LoginForm
  return null;
}

export default LoginPage;
