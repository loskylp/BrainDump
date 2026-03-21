/**
 * Unit tests for FolderCreateForm component (TASK-017).
 *
 * Verifies:
 *   - Renders input and submit button
 *   - Validates that name must be non-empty
 *   - Calls onCreated with folder object on success
 *   - Shows error message on API failure
 *   - Calls onCancel when Escape is pressed
 *   - Shows Cancel button only when onCancel prop is provided
 *   - Calls onCancel when Cancel button is clicked
 *
 * api/folders.js is mocked — no network calls occur.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderCreateForm from '../components/Sidebar/FolderCreateForm.jsx';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../api/folders.js', () => ({
  getFolders: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));

import { createFolder } from '../api/folders.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(overrides = {}) {
  const props = {
    onCreated: vi.fn(),
    onCancel: undefined,
    ...overrides,
  };
  render(<FolderCreateForm {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FolderCreateForm (TASK-017)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Rendering
  // =========================================================================

  describe('rendering', () => {
    it('renders a text input for the folder name', () => {
      renderForm();

      expect(screen.getByTestId('folder-name-input')).toBeTruthy();
    });

    it('renders a Create submit button', () => {
      renderForm();

      expect(screen.getByTestId('folder-create-submit')).toBeTruthy();
    });

    it('renders a Cancel button when onCancel prop is provided', () => {
      renderForm({ onCancel: vi.fn() });

      expect(screen.getByTestId('folder-create-cancel')).toBeTruthy();
    });

    it('does not render a Cancel button when onCancel prop is not provided', () => {
      renderForm();

      expect(screen.queryByTestId('folder-create-cancel')).toBeNull();
    });

    it('does not show an error initially', () => {
      renderForm();

      expect(screen.queryByTestId('folder-create-error')).toBeNull();
    });
  });

  // =========================================================================
  // Validation
  // =========================================================================

  describe('validation', () => {
    it('shows an error when submitting an empty name', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('folder-create-submit'));

      expect(screen.getByTestId('folder-create-error')).toBeTruthy();
    });

    it('does not call createFolder when name is empty', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('folder-create-submit'));

      expect(createFolder).not.toHaveBeenCalled();
    });

    it('shows an error when submitting a whitespace-only name', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.type(screen.getByTestId('folder-name-input'), '   ');
      await user.click(screen.getByTestId('folder-create-submit'));

      expect(screen.getByTestId('folder-create-error')).toBeTruthy();
    });
  });

  // =========================================================================
  // Successful submission
  // =========================================================================

  describe('successful submission', () => {
    it('calls createFolder with the trimmed name', async () => {
      const user = userEvent.setup();
      const folder = { id: 'f-1', name: 'Work', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-21T10:00:00Z' };
      createFolder.mockResolvedValue({ folder });
      renderForm();

      await user.type(screen.getByTestId('folder-name-input'), '  Work  ');
      await user.click(screen.getByTestId('folder-create-submit'));

      await waitFor(() => {
        expect(createFolder).toHaveBeenCalledWith('Work');
      });
    });

    it('calls onCreated with the returned folder object on success', async () => {
      const user = userEvent.setup();
      const folder = { id: 'f-1', name: 'Work', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-21T10:00:00Z' };
      createFolder.mockResolvedValue({ folder });
      const { onCreated } = renderForm();

      await user.type(screen.getByTestId('folder-name-input'), 'Work');
      await user.click(screen.getByTestId('folder-create-submit'));

      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledWith(folder);
      });
    });

    it('clears the input after successful creation', async () => {
      const user = userEvent.setup();
      const folder = { id: 'f-1', name: 'Work', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-21T10:00:00Z' };
      createFolder.mockResolvedValue({ folder });
      renderForm();

      const input = screen.getByTestId('folder-name-input');
      await user.type(input, 'Work');
      await user.click(screen.getByTestId('folder-create-submit'));

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  // =========================================================================
  // API failure
  // =========================================================================

  describe('API failure', () => {
    it('shows an error message when createFolder rejects', async () => {
      const user = userEvent.setup();
      createFolder.mockRejectedValue(new Error('Server error'));
      renderForm();

      await user.type(screen.getByTestId('folder-name-input'), 'Work');
      await user.click(screen.getByTestId('folder-create-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('folder-create-error')).toBeTruthy();
      });
    });

    it('does not call onCreated when createFolder rejects', async () => {
      const user = userEvent.setup();
      createFolder.mockRejectedValue(new Error('Server error'));
      const { onCreated } = renderForm();

      await user.type(screen.getByTestId('folder-name-input'), 'Work');
      await user.click(screen.getByTestId('folder-create-submit'));

      await waitFor(() => {
        expect(onCreated).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Cancel / Escape
  // =========================================================================

  describe('cancel and escape', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderForm({ onCancel });

      await user.click(screen.getByTestId('folder-create-cancel'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when Escape key is pressed while input is focused', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      renderForm({ onCancel });

      const input = screen.getByTestId('folder-name-input');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onCancel).toHaveBeenCalled();
    });

    it('does not throw when Escape is pressed and onCancel is not provided', async () => {
      const user = userEvent.setup();
      renderForm();

      const input = screen.getByTestId('folder-name-input');
      await user.click(input);
      // Should not throw
      await user.keyboard('{Escape}');
    });
  });
});
