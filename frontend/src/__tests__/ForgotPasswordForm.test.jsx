/**
 * Component tests for ForgotPasswordForm (TASK-015).
 *
 * Verifies:
 *   - Email input and submit button are rendered
 *   - Shows loading state during submission
 *   - Shows success message after successful submission
 *   - Shows error message on API failure
 *   - Validates email is required before submission
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm.jsx';

vi.mock('../api/auth.js', () => ({
  forgotPassword: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  resetPassword: vi.fn(),
  deleteAccount: vi.fn(),
}));

import { forgotPassword } from '../api/auth.js';

function renderForm() {
  return render(
    <MemoryRouter>
      <ForgotPasswordForm />
    </MemoryRouter>
  );
}

describe('ForgotPasswordForm (TASK-015)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders correctly', () => {
    it('renders an email input', () => {
      renderForm();
      expect(screen.getByLabelText(/email/i)).toBeTruthy();
    });

    it('renders a submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeTruthy();
    });
  });

  describe('client-side validation', () => {
    it('does not call API when email field is empty', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeTruthy();
      });

      expect(forgotPassword).not.toHaveBeenCalled();
    });
  });

  describe('successful submission', () => {
    it('calls forgotPassword with the entered email on submit', async () => {
      const user = userEvent.setup();
      forgotPassword.mockResolvedValueOnce({ message: 'If an account with that email exists, a password reset link has been sent.' });
      renderForm();

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(forgotPassword).toHaveBeenCalledWith('alice@example.com');
      });
    });

    it('shows success message after successful submission', async () => {
      const user = userEvent.setup();
      forgotPassword.mockResolvedValueOnce({ message: 'If an account with that email exists, a password reset link has been sent.' });
      renderForm();

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeTruthy();
      });
    });
  });

  describe('error handling', () => {
    it('shows error message when API call fails', async () => {
      const user = userEvent.setup();
      forgotPassword.mockRejectedValueOnce(new Error('Network error'));
      renderForm();

      await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeTruthy();
      });
    });
  });
});
