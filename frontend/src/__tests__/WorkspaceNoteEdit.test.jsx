/**
 * TASK-009 -- WorkspacePage note-edit integration tests.
 *
 * Verifies that WorkspacePage:
 *   AC-3: A "Save" button sends title and body to PUT /api/notes/:id
 *   AC-3: Cmd+S / Ctrl+S keyboard shortcut triggers a save
 *   AC-5: Opening a note from the catalog loads BOTH title and body into the editor
 *
 * Both useAuth and the notes API module are mocked.
 * No network calls or database interactions occur.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Mocks
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

vi.mock('../api/tags.js', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  addTagToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';
import { getNotes, getNote, updateNote } from '../api/notes.js';
import { getTags } from '../api/tags.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides = {}) {
  return {
    id: 'note-42',
    title: 'Original Title',
    body: 'Original body content',
    folder_id: null,
    updated_at: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

function renderWorkspacePage() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspacePage note editing (TASK-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: { id: '1', username: 'alice', email: 'alice@example.com' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    getNotes.mockResolvedValue({
      notes: [{ id: 'note-42', title: 'Original Title', updated_at: '2026-03-20T10:00:00.000Z', folder_id: null }],
    });
    getTags.mockResolvedValue({ tags: [] });

    getNote.mockResolvedValue({
      note: makeNote(),
    });

    updateNote.mockResolvedValue({
      note: makeNote({ title: 'Original Title', body: 'Original body content', updated_at: '2026-03-20T12:00:00.000Z' }),
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Editor loads title AND body when opening a note from the catalog
  // -------------------------------------------------------------------------

  describe('AC-5: loading note content', () => {
    it('loads the title into a title input field when a note is opened', async () => {
      const user = userEvent.setup();

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => {
        const titleInput = screen.getByTestId('note-title-input');
        expect(titleInput.value).toBe('Original Title');
      });
    });

    it('loads the body into the CodeMirror editor when a note is opened', async () => {
      const user = userEvent.setup();

      const { container } = renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => {
        const cm = container.querySelector('[data-testid="codemirror-mock"]');
        expect(cm).not.toBeNull();
        expect(cm.defaultValue).toBe('Original body content');
      });
    });

    it('clears the title input when no note is active', async () => {
      renderWorkspacePage();

      await waitFor(() => {
        const titleInput = screen.queryByTestId('note-title-input');
        // Either the input is absent or its value is empty when no note is selected
        if (titleInput) {
          expect(titleInput.value).toBe('');
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Save button triggers updateNote API call
  // -------------------------------------------------------------------------

  describe('AC-3: Save button', () => {
    it('renders a Save button when a note is active', async () => {
      const user = userEvent.setup();

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeTruthy();
      });
    });

    it('calls updateNote with the active note id when Save is clicked', async () => {
      const user = userEvent.setup();

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => screen.getByTestId('save-button'));

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(updateNote).toHaveBeenCalledWith(
          'note-42',
          expect.objectContaining({ title: expect.any(String), body: expect.any(String) })
        );
      });
    });

    it('sends the current title and body when Save is clicked', async () => {
      const user = userEvent.setup();

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => screen.getByTestId('save-button'));

      await user.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(updateNote).toHaveBeenCalledWith(
          'note-42',
          expect.objectContaining({ title: 'Original Title', body: 'Original body content' })
        );
      });
    });

    it('does not render a Save button when no note is active', async () => {
      getNotes.mockResolvedValue({ notes: [] });

      renderWorkspacePage();

      await waitFor(() => screen.getByText(/no notes yet/i));

      expect(screen.queryByTestId('save-button')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Cmd+S / Ctrl+S keyboard shortcut triggers save
  // -------------------------------------------------------------------------

  describe('AC-3: keyboard shortcut save', () => {
    it('calls updateNote when Ctrl+S is pressed while a note is active', async () => {
      const user = userEvent.setup();

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => screen.getByTestId('save-button'));

      // Fire Ctrl+S keyboard event on the document
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });

      await waitFor(() => {
        expect(updateNote).toHaveBeenCalledTimes(1);
      });
    });

    it('calls updateNote when Meta+S (Cmd+S) is pressed while a note is active', async () => {
      const user = userEvent.setup();

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Original Title'));
      await user.click(screen.getByText('Original Title'));

      await waitFor(() => screen.getByTestId('save-button'));

      fireEvent.keyDown(document, { key: 's', metaKey: true });

      await waitFor(() => {
        expect(updateNote).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call updateNote when Ctrl+S is pressed with no active note', async () => {
      getNotes.mockResolvedValue({ notes: [] });

      renderWorkspacePage();

      await waitFor(() => screen.getByText(/no notes yet/i));

      fireEvent.keyDown(document, { key: 's', ctrlKey: true });

      // Short wait to ensure no call happened
      await new Promise((r) => setTimeout(r, 50));
      expect(updateNote).not.toHaveBeenCalled();
    });
  });
});
