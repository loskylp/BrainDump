/**
 * Component tests for ResetPasswordForm (TASK-015).
 *
 * Verifies:
 *   - Renders password and confirm password inputs
 *   - Validates password minimum length
 *   - Validates password confirmation match
 *   - Shows success message with login link after successful reset
 *   - Shows error message on API failure (expired token)
 *   - Shows error state when no token is in URL
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResetPasswordForm from '../components/auth/ResetPasswordForm.jsx';

vi.mock('../api/auth.js', () => ({
  forgotPassword: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  resetPassword: vi.fn(),
  deleteAccount: vi.fn(),
}));

import { resetPassword } from '../api/auth.js';

/**
 * Renders ResetPasswordForm inside a router with an optional token query param.
 */
function renderForm(token = 'validtoken123') {
  const url = token ? `/reset-password?token=${token}` : '/reset-password';
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPasswordForm />
    </MemoryRouter>
  );
}

describe('ResetPasswordForm (TASK-015)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders correctly', () => {
    it('renders a new password input', () => {
      renderForm();
      expect(screen.getByLabelText(/new password/i)).toBeTruthy();
    });

    it('renders a confirm password input', () => {
      renderForm();
      expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
    });

    it('renders a submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeTruthy();
    });
  });

  describe('missing token in URL', () => {
    it('shows an error state when no token is present in URL', () => {
      renderForm('');
      expect(screen.getByText(/invalid.*reset link/i)).toBeTruthy();
    });

    it('does not render the password form when token is missing', () => {
      renderForm('');
      expect(screen.queryByLabelText(/new password/i)).toBeNull();
    });
  });

  describe('client-side validation', () => {
    it('shows error when password is shorter than 8 characters', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/new password/i), 'short');
      await user.type(screen.getByLabelText(/confirm password/i), 'short');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/at least 8 characters/i)).toBeTruthy();
      });

      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByLabelText(/new password/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different456');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
      });

      expect(resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('successful reset', () => {
    it('calls resetPassword with the token from URL and the new password', async () => {
      const user = userEvent.setup();
      resetPassword.mockResolvedValueOnce({ message: 'Password has been reset successfully' });
      renderForm('mytesttoken');

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(resetPassword).toHaveBeenCalledWith('mytesttoken', 'newpassword123');
      });
    });

    it('shows success message with login link after successful reset', async () => {
      const user = userEvent.setup();
      resetPassword.mockResolvedValueOnce({ message: 'Password has been reset successfully' });
      renderForm();

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password.*reset/i)).toBeTruthy();
      });

      expect(screen.getByRole('link', { name: /log in/i })).toBeTruthy();
    });
  });

  describe('API error handling', () => {
    it('shows error message when token is invalid or expired', async () => {
      const user = userEvent.setup();
      const err = new Error('Invalid or expired reset token');
      err.status = 400;
      err.error = 'INVALID_TOKEN';
      resetPassword.mockRejectedValueOnce(err);
      renderForm();

      await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
      });
    });
  });
});
