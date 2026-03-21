/**
 * TASK-008 -- WorkspacePage note catalog integration tests.
 *
 * Verifies that WorkspacePage:
 *   AC-2: Fetches notes via getNotes on mount and displays them in the sidebar
 *   AC-3: Clicking a note in the sidebar sets it as the active note
 *   AC-4: Creating a new note adds it to the sidebar list immediately
 *   AC-5: The active note is highlighted in the sidebar
 *
 * Both useAuth and the notes API module are mocked.
 * No network calls or database interactions occur.
 *
 * Updated by TASK-007: @uiw/react-codemirror is mocked so the Editor component
 * can mount without real CM6 DOM APIs. The stale assertion that checked for
 * the body text in a plain <p> tag (pre-TASK-007 placeholder behaviour) is
 * replaced with a check on the CodeMirror mock's defaultValue.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock CodeMirror to avoid jsdom incompatibility with CM6 DOM APIs.
// The mock renders a <textarea> so tests can check the editor value via
// container.querySelector('[data-testid="codemirror-mock"]').defaultValue.
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
import { getNotes, createNote, getNote } from '../api/notes.js';
import { getTags } from '../api/tags.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides = {}) {
  return {
    id: '1',
    title: 'Test Note',
    updated_at: '2026-03-20T10:00:00.000Z',
    folder_id: null,
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

describe('WorkspacePage note catalog (TASK-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuth.mockReturnValue({
      user: { id: '1', username: 'alice', email: 'alice@example.com' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    getNotes.mockResolvedValue({ notes: [] });
    getTags.mockResolvedValue({ tags: [] });
    createNote.mockResolvedValue({
      note: { id: 'new-note', title: 'New Note', body: '', folder_id: null, updated_at: '2026-03-20T12:00:00.000Z' },
    });
    getNote.mockResolvedValue({
      note: { id: 'note-42', title: 'Select Me', body: 'Body of selected note', folder_id: null, updated_at: '2026-03-20T10:00:00.000Z' },
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Fetches and displays notes on mount
  // -------------------------------------------------------------------------

  describe('initial note loading', () => {
    it('calls getNotes on mount', async () => {
      renderWorkspacePage();

      await waitFor(() => {
        expect(getNotes).toHaveBeenCalledTimes(1);
      });
    });

    it('displays fetched notes in the sidebar', async () => {
      getNotes.mockResolvedValue({
        notes: [makeNote({ id: '1', title: 'My First Note' })],
      });

      renderWorkspacePage();

      await waitFor(() => {
        expect(screen.getByText('My First Note')).toBeTruthy();
      });
    });

    it('shows empty state when user has no notes', async () => {
      getNotes.mockResolvedValue({ notes: [] });

      renderWorkspacePage();

      await waitFor(() => {
        expect(screen.getByText(/no notes yet/i)).toBeTruthy();
      });
    });

    it('displays multiple fetched notes', async () => {
      getNotes.mockResolvedValue({
        notes: [
          makeNote({ id: '1', title: 'Note Alpha' }),
          makeNote({ id: '2', title: 'Note Beta' }),
        ],
      });

      renderWorkspacePage();

      await waitFor(() => {
        expect(screen.getByText('Note Alpha')).toBeTruthy();
        expect(screen.getByText('Note Beta')).toBeTruthy();
      });
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Selecting a note sets it as active and loads its content
  // -------------------------------------------------------------------------

  describe('note selection', () => {
    it('marks the clicked note as active (aria-current=page)', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({
        notes: [makeNote({ id: 'note-42', title: 'Select Me' })],
      });

      renderWorkspacePage();

      await waitFor(() => {
        expect(screen.getByText('Select Me')).toBeTruthy();
      });

      await user.click(screen.getByText('Select Me'));

      await waitFor(() => {
        const noteItem = screen.getByText('Select Me').closest('[data-testid^="note-item"]');
        expect(noteItem.getAttribute('aria-current')).toBe('page');
      });
    });

    it('calls getNote with the selected note id when a note is clicked', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({
        notes: [makeNote({ id: 'note-42', title: 'Select Me' })],
      });

      renderWorkspacePage();

      await waitFor(() => screen.getByText('Select Me'));

      await user.click(screen.getByText('Select Me'));

      await waitFor(() => {
        expect(getNote).toHaveBeenCalledWith('note-42');
      });
    });

    it('loads the body of the selected note into the CodeMirror editor after clicking', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({
        notes: [makeNote({ id: 'note-42', title: 'Select Me' })],
      });
      getNote.mockResolvedValue({
        note: { id: 'note-42', title: 'Select Me', body: 'Body of selected note', folder_id: null, updated_at: '2026-03-20T10:00:00.000Z' },
      });

      const { container } = renderWorkspacePage();

      await waitFor(() => screen.getByText('Select Me'));

      await user.click(screen.getByText('Select Me'));

      // TASK-007: The body is now held in the CodeMirror editor (via the
      // controlled editorBody state), not a plain <p> tag. The mock CM6
      // component exposes the value via defaultValue on the <textarea>.
      await waitFor(() => {
        const cm = container.querySelector('[data-testid="codemirror-mock"]');
        expect(cm).not.toBeNull();
        expect(cm.defaultValue).toBe('Body of selected note');
      });
    });

    it('does not call getNote on mount when no note is active', async () => {
      getNotes.mockResolvedValue({ notes: [] });

      renderWorkspacePage();

      await waitFor(() => screen.getByText(/no notes yet/i));

      expect(getNote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: Creating a note adds it to the sidebar immediately
  // -------------------------------------------------------------------------

  describe('create new note', () => {
    it('calls createNote when the new note button is clicked', async () => {
      const user = userEvent.setup();
      renderWorkspacePage();

      // Wait for sidebar to render
      await waitFor(() => screen.getByRole('button', { name: /new note/i }));

      await user.click(screen.getByRole('button', { name: /new note/i }));

      await waitFor(() => {
        expect(createNote).toHaveBeenCalledTimes(1);
      });
    });

    it('adds the new note to the sidebar list after creation', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({ notes: [] });
      createNote.mockResolvedValue({
        note: makeNote({ id: 'brand-new', title: 'Brand New Note' }),
      });

      renderWorkspacePage();

      await waitFor(() => screen.getByRole('button', { name: /new note/i }));

      await user.click(screen.getByRole('button', { name: /new note/i }));

      await waitFor(() => {
        expect(screen.getByText('Brand New Note')).toBeTruthy();
      });
    });

    it('makes the new note the active note after creation', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({ notes: [] });
      createNote.mockResolvedValue({
        note: makeNote({ id: 'brand-new', title: 'Brand New Note' }),
      });

      renderWorkspacePage();

      await waitFor(() => screen.getByRole('button', { name: /new note/i }));

      await user.click(screen.getByRole('button', { name: /new note/i }));

      await waitFor(() => {
        const noteItem = screen.getByText('Brand New Note').closest('[data-testid^="note-item"]');
        expect(noteItem.getAttribute('aria-current')).toBe('page');
      });
    });
  });
});
