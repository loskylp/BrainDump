/**
 * Root application component.
 *
 * Defines the client-side route structure for the entire BrainDump SPA.
 * Uses React Router v6 <Routes> / <Route> components.
 *
 * Route map:
 *   /              -- LandingPage (public; authenticated users redirect to /workspace)
 *   /login         -- LoginPage (public)
 *   /register      -- RegisterPage (public)
 *   /workspace     -- WorkspacePage (protected via ProtectedRoute)
 *
 * ProtectedRoute component (src/components/common/ProtectedRoute.jsx):
 *   Reads authentication state from useAuth hook.
 *   If authenticated: renders the child route.
 *   If not authenticated: redirects to /login (using React Router <Navigate>).
 *
 * Authentication state is provided by useAuth (src/hooks/useAuth.js), which
 * checks session state via GET /api/auth/me or equivalent on mount.
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import ProtectedRoute from './components/common/ProtectedRoute.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';

/**
 * Landing route wrapper.
 * Authenticated users are redirected to /workspace; others see LandingPage.
 */
function LandingRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/workspace" replace />;
  }

  return <LandingPage />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <WorkspacePage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
