/**
 * TASK-016 -- Acceptance Criterion 2
 * Verifies ProtectedRoute redirects unauthenticated users to /login.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute.jsx';

// Mock useAuth to control authentication state
vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    useAuth.mockReturnValue({
      user: { id: '1', username: 'test', email: 'test@test.com' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeTruthy();
  });

  it('redirects to /login when not authenticated', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.getByText('Login Page')).toBeTruthy();
  });

  it('renders null while loading', () => {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).toBeNull();
    expect(screen.queryByText('Login Page')).toBeNull();
  });
});
