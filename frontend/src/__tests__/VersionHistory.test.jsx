/**
 * Tests for VersionHistory component (TASK-013 AC-10).
 *
 * Verifies:
 *   - Displays version list with version numbers and timestamps
 *   - Allows selecting a version to preview its content
 *   - Restore button triggers confirmation and calls restoreVersion
 *   - Close button calls onClose callback
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VersionHistory from '../components/editor/VersionHistory.jsx';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetVersions = vi.fn();
const mockRestoreVersion = vi.fn();

vi.mock('../../src/api/versions.js', async () => ({
  getVersions: (...args) => mockGetVersions(...args),
  restoreVersion: (...args) => mockRestoreVersion(...args),
  checkVersion: vi.fn(),
  getVersion: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const VERSIONS = [
  {
    id: 'v3',
    version_number: 3,
    title: 'Title v3',
    body: 'Body version 3',
    created_at: '2026-03-20T14:00:00.000Z',
  },
  {
    id: 'v2',
    version_number: 2,
    title: 'Title v2',
    body: 'Body version 2',
    created_at: '2026-03-20T12:00:00.000Z',
  },
  {
    id: 'v1',
    version_number: 1,
    title: 'Title v1',
    body: 'Body version 1',
    created_at: '2026-03-20T10:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VersionHistory', () => {
  const onClose = vi.fn();
  const onRestore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVersions.mockResolvedValue({ versions: VERSIONS });
    mockRestoreVersion.mockResolvedValue({
      note: { id: 'n1', title: 'Restored', body: 'Restored body', updated_at: '2026-03-20T15:00:00.000Z' },
      newVersionNumber: 4,
    });
  });

  it('renders the version history panel', async () => {
    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-history-panel')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    mockGetVersions.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays version list after loading', async () => {
    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('version-item-3')).toBeInTheDocument();
    expect(screen.getByTestId('version-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('version-item-1')).toBeInTheDocument();
  });

  it('shows version content preview when a version is selected', async () => {
    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-item-2')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-item-2'));
    });

    expect(screen.getByTestId('version-preview-content')).toBeInTheDocument();
    expect(screen.getByText('Body version 2')).toBeInTheDocument();
  });

  it('shows restore button when a version is selected', async () => {
    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-item-1')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-item-1'));
    });

    expect(screen.getByTestId('version-restore-button')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-history-close')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-history-close'));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls restoreVersion and onRestore when restore is confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-item-2')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-item-2'));
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-restore-button'));
    });

    expect(mockRestoreVersion).toHaveBeenCalledWith('n1', 'v2');
    expect(onRestore).toHaveBeenCalledWith({
      title: 'Restored',
      body: 'Restored body',
    });

    confirmSpy.mockRestore();
  });

  it('does not restore when confirmation is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByTestId('version-item-1')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-item-1'));
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('version-restore-button'));
    });

    expect(mockRestoreVersion).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('displays empty state when no versions exist', async () => {
    mockGetVersions.mockResolvedValue({ versions: [] });

    render(<VersionHistory noteId="n1" onClose={onClose} onRestore={onRestore} />);

    await waitFor(() => {
      expect(screen.getByText('No versions yet.')).toBeInTheDocument();
    });
  });
});
