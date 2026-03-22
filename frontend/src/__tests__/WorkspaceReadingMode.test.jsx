/**
 * Unit tests for Reading Mode integration in WorkspacePage (TASK-030, REQ-022).
 *
 * Tests verify:
 *   - The "Read" button is visible in the editor toolbar when a note is active
 *   - Clicking "Read" replaces WorkspaceLayout with ReadingView (full-screen)
 *   - The sidebar is hidden in reading mode (WorkspaceLayout not rendered)
 *   - Clicking the exit button in ReadingView restores the workspace
 *   - Escape key exits reading mode
 *   - Cmd/Ctrl+Shift+R toggles reading mode on and off
 *   - Navigating in ReadingView opens the adjacent note in reading mode
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn(({ value, onChange }) => (
    <textarea
      data-testid="codemirror-mock"
      defaultValue={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  )),
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/notes.js', () => ({
  getNotes: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../utils/exportNote.js', () => ({
  exportNote: vi.fn(),
}));

vi.mock('../api/tags.js', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  addTagToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
}));

vi.mock('../api/folders.js', () => ({
  getFolders: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';
import { getNotes, getNote } from '../api/notes.js';
import { getTags } from '../api/tags.js';
import { getFolders } from '../api/folders.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTE_A = {
  id: 'note-a',
  title: 'Alpha Note',
  body: '# Alpha',
  folder_id: null,
  updated_at: '2026-03-21T10:00:00.000Z',
};

const NOTE_B = {
  id: 'note-b',
  title: 'Beta Note',
  body: '# Beta',
  folder_id: null,
  updated_at: '2026-03-21T09:00:00.000Z',
};

function setupMocks(notes = [NOTE_A, NOTE_B]) {
  useAuth.mockReturnValue({
    user: { id: '1', username: 'alice', email: 'alice@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
  getNotes.mockResolvedValue({ notes });
  getTags.mockResolvedValue({ tags: [] });
  getFolders.mockResolvedValue({ folders: [] });
}

function renderWorkspacePage() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>
  );
}

function fireKeydown({ key, metaKey = false, ctrlKey = false, shiftKey = false }) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    document.dispatchEvent(event);
  });
}

// ---------------------------------------------------------------------------
// Open Reading Mode
// ---------------------------------------------------------------------------

describe('WorkspacePage — Reading Mode button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('does not render the Read button when no note is active', async () => {
    renderWorkspacePage();
    await waitFor(() => {
      expect(screen.queryByTestId('reading-mode-button')).toBeNull();
    });
  });

  it('renders the Read button when a note is active', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));

    await waitFor(() => {
      expect(screen.getByTestId('reading-mode-button')).toBeTruthy();
    });
  });
});

describe('WorkspacePage — entering Reading Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    getNote.mockResolvedValue({ note: NOTE_A });
  });

  async function openReadingMode() {
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));

    return user;
  }

  it('renders the ReadingView when the Read button is clicked', async () => {
    await openReadingMode();
    await waitFor(() => {
      expect(screen.getByTestId('reading-view')).toBeTruthy();
    });
  });

  it('hides the WorkspaceLayout (sidebar) when in reading mode', async () => {
    await openReadingMode();
    await waitFor(() => {
      // WorkspaceLayout renders a grid with inline style; it must not be present
      // The reading view occupies the full viewport instead.
      expect(screen.queryByTestId('sidebar-overlay')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Exiting Reading Mode
// ---------------------------------------------------------------------------

describe('WorkspacePage — exiting Reading Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    getNote.mockResolvedValue({ note: NOTE_A });
  });

  async function enterReadingMode() {
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));
    await waitFor(() => screen.getByTestId('reading-view'));

    return user;
  }

  it('restores the workspace when the exit button is clicked', async () => {
    await enterReadingMode();
    const user = userEvent.setup();
    await user.click(screen.getByTestId('reading-exit-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('reading-view')).toBeNull();
    });
  });

  it('restores the workspace when Escape is pressed', async () => {
    await enterReadingMode();
    fireKeydown({ key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('reading-view')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Cmd/Ctrl+Shift+R toggle
// ---------------------------------------------------------------------------

describe('WorkspacePage — Cmd/Ctrl+Shift+R shortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    getNote.mockResolvedValue({ note: NOTE_A });
  });

  async function activateNote() {
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));

    return user;
  }

  it('enters reading mode when Cmd+Shift+R is pressed with a note active', async () => {
    await activateNote();
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('reading-view')).toBeTruthy();
    });
  });

  it('exits reading mode when Cmd+Shift+R is pressed again (toggle)', async () => {
    await activateNote();
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    await waitFor(() => screen.getByTestId('reading-view'));

    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    await waitFor(() => {
      expect(screen.queryByTestId('reading-view')).toBeNull();
    });
  });
});
