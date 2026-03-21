/**
 * Frontend tests for TASK-010: Delete a note.
 *
 * Tests verify:
 *   - AC-2: Confirmation dialog prevents accidental deletion
 *   - AC-4: After deletion, note is removed from the sidebar catalog
 *   - AC-5: Canceling the confirmation does not delete the note
 *   - Delete button is visible only when a note is active
 *   - deleteNote API is called with the correct noteId
 *   - Editor is cleared after successful deletion
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: { username: 'testuser', email: 'test@test.com' },
    logout: mockLogout,
  }),
}));

const mockGetNotes = vi.fn();
const mockCreateNote = vi.fn();
const mockGetNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();

vi.mock('../api/notes.js', () => ({
  getNotes: (...args) => mockGetNotes(...args),
  createNote: (...args) => mockCreateNote(...args),
  getNote: (...args) => mockGetNote(...args),
  updateNote: (...args) => mockUpdateNote(...args),
  deleteNote: (...args) => mockDeleteNote(...args),
}));

const mockGetTags = vi.fn().mockResolvedValue({ tags: [] });
vi.mock('../api/tags.js', () => ({
  getTags: (...args) => mockGetTags(...args),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  addTagToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTE_1 = {
  id: 'note-1',
  title: 'First Note',
  body: '# Hello',
  updated_at: '2026-03-20T10:00:00.000Z',
  folder_id: null,
};

const NOTE_2 = {
  id: 'note-2',
  title: 'Second Note',
  body: '# World',
  updated_at: '2026-03-19T10:00:00.000Z',
  folder_id: null,
};

function renderWorkspace() {
  return render(
    <MemoryRouter>
      <WorkspacePage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-010: Delete a note', () => {
  let confirmSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNotes.mockResolvedValue({ notes: [NOTE_1, NOTE_2] });
    mockGetNote.mockResolvedValue({ note: NOTE_1 });
    mockDeleteNote.mockResolvedValue(null);
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('shows delete button when a note is active', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId(`note-item-${NOTE_1.id}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-note-button')).toBeInTheDocument();
    });
  });

  it('does not show delete button when no note is active', async () => {
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('delete-note-button')).not.toBeInTheDocument();
  });

  it('shows a confirmation dialog when delete is clicked (AC-2)', async () => {
    confirmSpy.mockReturnValue(false);
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId(`note-item-${NOTE_1.id}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-note-button')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('delete-note-button'));
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain('First Note');
  });

  it('does not delete the note when confirmation is cancelled (AC-5)', async () => {
    confirmSpy.mockReturnValue(false);
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId(`note-item-${NOTE_1.id}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-note-button')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('delete-note-button'));
    });

    expect(mockDeleteNote).not.toHaveBeenCalled();
    // Note should still be in the sidebar
    expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
  });

  it('calls deleteNote API when confirmed (AC-1)', async () => {
    confirmSpy.mockReturnValue(true);
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId(`note-item-${NOTE_1.id}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-note-button')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('delete-note-button'));
    });

    expect(mockDeleteNote).toHaveBeenCalledWith(NOTE_1.id);
  });

  it('removes the note from the sidebar after deletion (AC-4)', async () => {
    confirmSpy.mockReturnValue(true);
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId(`note-item-${NOTE_1.id}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-note-button')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('delete-note-button'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`note-item-${NOTE_1.id}`)).not.toBeInTheDocument();
    });

    // Second note should still be there
    expect(screen.getByTestId(`note-item-${NOTE_2.id}`)).toBeInTheDocument();
  });

  it('clears the editor after deletion', async () => {
    confirmSpy.mockReturnValue(true);
    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId(`note-item-${NOTE_1.id}`)).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId(`note-item-${NOTE_1.id}`));
    });

    await waitFor(() => {
      expect(screen.getByTestId('delete-note-button')).toBeInTheDocument();
    });

    await act(async () => {
      await userEvent.click(screen.getByTestId('delete-note-button'));
    });

    await waitFor(() => {
      // Delete button should be gone (no active note)
      expect(screen.queryByTestId('delete-note-button')).not.toBeInTheDocument();
    });
  });
});
