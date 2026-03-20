/**
 * TASK-004 -- LoginPage Component Tests
 *
 * Tests page shell, navigation on success, and register link.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../pages/LoginPage.jsx';

// Mock the auth API module
vi.mock('../api/auth.js', () => ({
  login: vi.fn(),
}));

import { login as loginApi } from '../api/auth.js';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/workspace" element={<div>Workspace</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginApi.mockReset();
  });

  it('renders a page heading', () => {
    renderLoginPage();
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('renders a link to the register page', () => {
    renderLoginPage();
    const registerLink = screen.getByRole('link', { name: /create account/i });
    expect(registerLink).toBeTruthy();
  });

  it('navigates to /workspace after successful login', async () => {
    const user = userEvent.setup();
    loginApi.mockResolvedValueOnce({ user: { id: '1', username: 'alice', email: 'alice@example.com' } });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText('Workspace')).toBeTruthy();
    });
  });
});
