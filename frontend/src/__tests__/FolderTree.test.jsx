/**
 * Unit tests for FolderTree component (TASK-017).
 *
 * Verifies:
 *   - Renders "All Notes" item at the top
 *   - Renders each folder as a clickable item
 *   - Highlights the active folder with active styles
 *   - Calling onFolderSelect when a folder is clicked
 *   - Rename flow: shows inline input, submits, calls onFolderRenamed
 *   - Delete flow: shows confirm dialog, calls onFolderDeleted on confirmation
 *
 * api/folders.js is mocked — no network calls occur.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FolderTree from '../components/Sidebar/FolderTree.jsx';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../api/folders.js', () => ({
  getFolders: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));

import { updateFolder, deleteFolder } from '../api/folders.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FOLDERS = [
  { id: 'folder-1', name: 'Alpha', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-21T10:00:00Z' },
  { id: 'folder-2', name: 'Beta', created_at: '2026-03-21T10:00:00Z', updated_at: '2026-03-21T10:00:00Z' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFolderTree(overrides = {}) {
  const props = {
    folders: FOLDERS,
    activeFolderId: null,
    onFolderSelect: vi.fn(),
    onFolderRenamed: vi.fn(),
    onFolderDeleted: vi.fn(),
    ...overrides,
  };
  render(<FolderTree {...props} />);
  return props;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FolderTree (TASK-017)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Rendering
  // =========================================================================

  describe('rendering', () => {
    it('renders an "All Notes" item at the top', () => {
      renderFolderTree();

      expect(screen.getByTestId('folder-all-notes')).toBeTruthy();
      expect(screen.getByTestId('folder-all-notes').textContent).toBe('All Notes');
    });

    it('renders each folder as a clickable item', () => {
      renderFolderTree();

      expect(screen.getByTestId('folder-item-folder-1')).toBeTruthy();
      expect(screen.getByTestId('folder-item-folder-2')).toBeTruthy();
    });

    it('renders folder names', () => {
      renderFolderTree();

      expect(screen.getByText('Alpha')).toBeTruthy();
      expect(screen.getByText('Beta')).toBeTruthy();
    });

    it('renders an empty list when folders is empty', () => {
      renderFolderTree({ folders: [] });

      expect(screen.getByTestId('folder-all-notes')).toBeTruthy();
      expect(screen.queryByTestId('folder-item-folder-1')).toBeNull();
    });
  });

  // =========================================================================
  // Active folder highlighting
  // =========================================================================

  describe('active folder highlighting', () => {
    it('highlights "All Notes" when activeFolderId is null', () => {
      renderFolderTree({ activeFolderId: null });

      const allNotes = screen.getByTestId('folder-all-notes').closest('li');
      expect(allNotes.className).toContain('border-accent');
    });

    it('does not highlight "All Notes" when a folder is active', () => {
      renderFolderTree({ activeFolderId: 'folder-1' });

      const allNotes = screen.getByTestId('folder-all-notes').closest('li');
      expect(allNotes.className).not.toContain('border-accent');
    });

    it('highlights the active folder', () => {
      renderFolderTree({ activeFolderId: 'folder-1' });

      const folder1Li = screen.getByTestId('folder-item-folder-1').closest('li');
      expect(folder1Li.className).toContain('border-accent');
    });

    it('does not highlight inactive folders', () => {
      renderFolderTree({ activeFolderId: 'folder-1' });

      const folder2Li = screen.getByTestId('folder-item-folder-2').closest('li');
      expect(folder2Li.className).not.toContain('border-accent');
    });
  });

  // =========================================================================
  // Click handlers
  // =========================================================================

  describe('click handlers', () => {
    it('calls onFolderSelect(null) when "All Notes" is clicked', async () => {
      const user = userEvent.setup();
      const { onFolderSelect } = renderFolderTree();

      await user.click(screen.getByTestId('folder-all-notes'));

      expect(onFolderSelect).toHaveBeenCalledWith(null);
    });

    it('calls onFolderSelect with folder id when a folder is clicked', async () => {
      const user = userEvent.setup();
      const { onFolderSelect } = renderFolderTree();

      await user.click(screen.getByTestId('folder-item-folder-1'));

      expect(onFolderSelect).toHaveBeenCalledWith('folder-1');
    });

    it('calls onFolderSelect with the correct id for each folder', async () => {
      const user = userEvent.setup();
      const { onFolderSelect } = renderFolderTree();

      await user.click(screen.getByTestId('folder-item-folder-2'));

      expect(onFolderSelect).toHaveBeenCalledWith('folder-2');
    });
  });

  // =========================================================================
  // Rename flow
  // =========================================================================

  describe('rename flow', () => {
    it('shows inline rename input when rename button is clicked', async () => {
      const user = userEvent.setup();
      renderFolderTree();

      await user.click(screen.getByTestId('folder-rename-button-folder-1'));

      expect(screen.getByTestId('folder-rename-input-folder-1')).toBeTruthy();
    });

    it('pre-populates the rename input with the current folder name', async () => {
      const user = userEvent.setup();
      renderFolderTree();

      await user.click(screen.getByTestId('folder-rename-button-folder-1'));

      const input = screen.getByTestId('folder-rename-input-folder-1');
      expect(input.value).toBe('Alpha');
    });

    it('calls updateFolder and onFolderRenamed on submit', async () => {
      const user = userEvent.setup();
      updateFolder.mockResolvedValue({ folder: { id: 'folder-1', name: 'Renamed' } });
      const { onFolderRenamed } = renderFolderTree();

      await user.click(screen.getByTestId('folder-rename-button-folder-1'));
      const input = screen.getByTestId('folder-rename-input-folder-1');
      await user.clear(input);
      await user.type(input, 'Renamed');
      await user.click(screen.getByTestId('folder-rename-submit-folder-1'));

      await waitFor(() => {
        expect(updateFolder).toHaveBeenCalledWith('folder-1', 'Renamed');
        expect(onFolderRenamed).toHaveBeenCalledWith('folder-1', 'Renamed');
      });
    });

    it('hides the rename form after successful rename', async () => {
      const user = userEvent.setup();
      updateFolder.mockResolvedValue({ folder: { id: 'folder-1', name: 'Renamed' } });
      renderFolderTree();

      await user.click(screen.getByTestId('folder-rename-button-folder-1'));
      const input = screen.getByTestId('folder-rename-input-folder-1');
      await user.clear(input);
      await user.type(input, 'Renamed');
      await user.click(screen.getByTestId('folder-rename-submit-folder-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('folder-rename-input-folder-1')).toBeNull();
      });
    });

    it('dismisses rename form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderFolderTree();

      await user.click(screen.getByTestId('folder-rename-button-folder-1'));
      await user.click(screen.getByTestId('folder-rename-cancel-folder-1'));

      expect(screen.queryByTestId('folder-rename-input-folder-1')).toBeNull();
    });

    it('dismisses rename form when Escape is pressed', async () => {
      const user = userEvent.setup();
      renderFolderTree();

      await user.click(screen.getByTestId('folder-rename-button-folder-1'));
      const input = screen.getByTestId('folder-rename-input-folder-1');
      await user.type(input, '{Escape}');

      expect(screen.queryByTestId('folder-rename-input-folder-1')).toBeNull();
    });
  });

  // =========================================================================
  // Delete flow
  // =========================================================================

  describe('delete flow', () => {
    it('calls window.confirm before deleting', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      deleteFolder.mockResolvedValue(null);
      renderFolderTree();

      await user.click(screen.getByTestId('folder-delete-button-folder-1'));

      expect(confirmSpy).toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('calls deleteFolder and onFolderDeleted when confirmed', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      deleteFolder.mockResolvedValue(null);
      const { onFolderDeleted } = renderFolderTree();

      await user.click(screen.getByTestId('folder-delete-button-folder-1'));

      await waitFor(() => {
        expect(deleteFolder).toHaveBeenCalledWith('folder-1');
        expect(onFolderDeleted).toHaveBeenCalledWith('folder-1');
      });

      vi.spyOn(window, 'confirm').mockRestore();
    });

    it('does not call deleteFolder when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { onFolderDeleted } = renderFolderTree();

      await user.click(screen.getByTestId('folder-delete-button-folder-1'));

      expect(deleteFolder).not.toHaveBeenCalled();
      expect(onFolderDeleted).not.toHaveBeenCalled();

      vi.spyOn(window, 'confirm').mockRestore();
    });
  });
});
