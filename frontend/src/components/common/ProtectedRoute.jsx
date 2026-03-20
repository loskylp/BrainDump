/**
 * ProtectedRoute component.
 *
 * React Router v6 route guard. Wraps routes that require authentication.
 * Reads authentication state from useAuth and redirects to /login if the
 * user is not authenticated.
 *
 * Handles the loading state during the initial session check: renders null
 * (or a minimal loading indicator) while isLoading=true, to prevent a flash
 * of the login redirect before the session check resolves.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - The protected page component to render
 * @returns {JSX.Element | null}
 *
 * @postcondition If isLoading=true: renders null (suspends render while session resolves)
 * @postcondition If isAuthenticated=true: renders props.children
 * @postcondition If isAuthenticated=false: renders <Navigate to="/login" replace />
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
