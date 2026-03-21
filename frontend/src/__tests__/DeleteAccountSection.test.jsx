/**
 * Unit tests for DeleteAccountSection (TASK-019).
 *
 * Verifies:
 *   - Renders warning message and password input (in confirming phase)
 *   - Submit calls deleteAccount(password)
 *   - On success: calls onSuccess callback (which parent uses to navigate to /login)
 *   - On error (wrong password): shows inline error message
 *   - Initial idle state shows "Delete my account" button, not the password input
 *   - Cancel returns component to idle state
 *
 * deleteAccount from api/auth.js is mocked — no network calls occur.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeleteAccountSection from '../components/auth/DeleteAccountSection.jsx';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../api/auth.js', () => ({
  deleteAccount: vi.fn(),
}));

import { deleteAccount } from '../api/auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders DeleteAccountSection with an onSuccess spy and returns both the
 * rendered output and the spy.
 *
 * @returns {{ onSuccess: import('vitest').MockedFunction }}
 */
function renderComponent() {
  const onSuccess = vi.fn();
  render(<DeleteAccountSection onSuccess={onSuccess} />);
  return { onSuccess };
}

/**
 * Clicks the "Delete my account" button to enter the confirming phase,
 * then returns the user event helper.
 *
 * @returns {import('@testing-library/user-event').UserEvent}
 */
async function enterConfirmingPhase() {
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: /delete my account/i });
  await user.click(trigger);
  return user;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeleteAccountSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Idle state
  // -------------------------------------------------------------------------

  describe('idle state (initial render)', () => {
    it('renders a "Delete my account" button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /delete my account/i })).toBeTruthy();
    });

    it('does not render a password input in idle state', () => {
      renderComponent();
      expect(screen.queryByLabelText(/password/i)).toBeNull();
      expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Confirming state (after clicking "Delete my account")
  // -------------------------------------------------------------------------

  describe('confirming state', () => {
    it('shows the warning message when in confirming state', async () => {
      renderComponent();
      await enterConfirmingPhase();

      expect(
        screen.getByText(/permanently delete your account and all your notes/i)
      ).toBeTruthy();
    });

    it('shows the "This cannot be undone" warning text', async () => {
      renderComponent();
      await enterConfirmingPhase();

      expect(screen.getByText(/this cannot be undone/i)).toBeTruthy();
    });

    it('renders a password input in confirming state', async () => {
      renderComponent();
      await enterConfirmingPhase();

      const input = screen.getByPlaceholderText(/password/i);
      expect(input).toBeTruthy();
    });

    it('renders a "Confirm delete" button in confirming state', async () => {
      renderComponent();
      await enterConfirmingPhase();

      expect(screen.getByRole('button', { name: /confirm delete/i })).toBeTruthy();
    });

    it('renders a "Cancel" button in confirming state', async () => {
      renderComponent();
      await enterConfirmingPhase();

      expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
    });

    it('returns to idle state when Cancel is clicked', async () => {
      renderComponent();
      const user = await enterConfirmingPhase();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Back to idle: password input gone, "Delete my account" button visible
      expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
      expect(screen.getByRole('button', { name: /delete my account/i })).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Submission
  // -------------------------------------------------------------------------

  describe('on submit with correct password', () => {
    it('calls deleteAccount with the entered password', async () => {
      deleteAccount.mockResolvedValue({ message: 'Account deleted successfully' });
      renderComponent();
      const user = await enterConfirmingPhase();

      const input = screen.getByPlaceholderText(/password/i);
      await user.type(input, 'my-secret-password');

      const confirmButton = screen.getByRole('button', { name: /confirm delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteAccount).toHaveBeenCalledWith('my-secret-password');
      });
    });

    it('calls onSuccess after successful deletion', async () => {
      deleteAccount.mockResolvedValue({ message: 'Account deleted successfully' });
      const { onSuccess } = renderComponent();
      const user = await enterConfirmingPhase();

      await user.type(screen.getByPlaceholderText(/password/i), 'my-secret-password');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('on submit with wrong password', () => {
    it('shows "Incorrect password" error message', async () => {
      const { ApiError } = await import('../api/client.js');
      deleteAccount.mockRejectedValue(new ApiError(401, 'Invalid password', 'INVALID_CREDENTIALS'));

      renderComponent();
      const user = await enterConfirmingPhase();

      await user.type(screen.getByPlaceholderText(/password/i), 'wrong-password');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(screen.getByText(/incorrect password/i)).toBeTruthy();
      });
    });

    it('does not call onSuccess when password is wrong', async () => {
      const { ApiError } = await import('../api/client.js');
      deleteAccount.mockRejectedValue(new ApiError(401, 'Invalid password', 'INVALID_CREDENTIALS'));

      const { onSuccess } = renderComponent();
      const user = await enterConfirmingPhase();

      await user.type(screen.getByPlaceholderText(/password/i), 'wrong-password');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(screen.getByText(/incorrect password/i)).toBeTruthy();
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('shows a generic error message for non-credential errors', async () => {
      deleteAccount.mockRejectedValue(new Error('Network failure'));

      renderComponent();
      const user = await enterConfirmingPhase();

      await user.type(screen.getByPlaceholderText(/password/i), 'some-password');
      await user.click(screen.getByRole('button', { name: /confirm delete/i }));

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeTruthy();
      });
    });
  });
});
