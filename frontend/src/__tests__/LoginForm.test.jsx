/**
 * TASK-004 -- LoginForm Component Tests
 *
 * Tests client-side validation and API interaction for the login form.
 * Covers AC-3 (client-side validation before submission) and AC-1 (invokes
 * onSuccess with user object on successful login).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../components/auth/LoginForm.jsx';

// Mock the auth API module
vi.mock('../api/auth.js', () => ({
  login: vi.fn(),
}));

import { login as loginApi } from '../api/auth.js';

describe('LoginForm', () => {
  let onSuccess;
  let onForgotPassword;
  let user;

  beforeEach(() => {
    onSuccess = vi.fn();
    onForgotPassword = vi.fn();
    loginApi.mockReset();
    user = userEvent.setup();
  });

  describe('renders correctly', () => {
    it('renders email, password fields and submit button', () => {
      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      expect(screen.getByLabelText(/email/i)).toBeTruthy();
      expect(screen.getByLabelText(/password/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /log in/i })).toBeTruthy();
    });
  });

  describe('client-side validation', () => {
    it('shows error and does not call API when email is empty', async () => {
      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeTruthy();
      });

      expect(loginApi).not.toHaveBeenCalled();
    });

    it('shows error and does not call API when password is empty', async () => {
      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeTruthy();
      });

      expect(loginApi).not.toHaveBeenCalled();
    });

    it('shows error for invalid email format', async () => {
      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.type(screen.getByLabelText(/email/i), 'notanemail');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeTruthy();
      });

      expect(loginApi).not.toHaveBeenCalled();
    });
  });

  describe('successful login', () => {
    it('calls loginApi with email and password on valid submission', async () => {
      loginApi.mockResolvedValueOnce({ user: { id: '1', username: 'alice', email: 'alice@example.com' } });

      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(loginApi).toHaveBeenCalledWith('alice@example.com', 'password123');
      });
    });

    it('calls onSuccess with the user object on successful login', async () => {
      const mockUser = { id: '1', username: 'alice', email: 'alice@example.com' };
      loginApi.mockResolvedValueOnce({ user: mockUser });

      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockUser);
      });
    });
  });

  describe('API error handling', () => {
    it('shows "Invalid email or password" on 401 response', async () => {
      const { ApiError } = await import('../api/client.js');
      loginApi.mockRejectedValueOnce(new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS'));

      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeTruthy();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('shows generic error message on unexpected server error', async () => {
      const { ApiError } = await import('../api/client.js');
      loginApi.mockRejectedValueOnce(new ApiError(500, 'Internal server error', 'INTERNAL_ERROR'));

      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByTestId('server-error')).toBeTruthy();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('forgot password link', () => {
    it('calls onForgotPassword when the link is clicked', async () => {
      render(<LoginForm onSuccess={onSuccess} onForgotPassword={onForgotPassword} />);

      await user.click(screen.getByText(/forgot password/i));

      expect(onForgotPassword).toHaveBeenCalled();
    });
  });
});
