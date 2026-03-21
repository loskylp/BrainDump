/**
 * TASK-007 -- WorkspacePage Editor + Preview integration tests.
 *
 * Verifies that WorkspacePage:
 *   AC-1: Renders the Editor component in the editor panel slot
 *   AC-1: Renders the Preview component in the preview panel slot
 *   AC-2: When a note is selected, its body is passed to the Editor
 *   AC-2: The Preview receives the same body value as the Editor
 *
 * Both @uiw/react-codemirror and API modules are mocked.
 * No network calls or CodeMirror DOM APIs are invoked.
 *
 * The empty-note state is also verified: when no note is selected, the
 * editor and preview render empty / with empty-state indicators.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock CodeMirror to avoid jsdom incompatibility
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

// ---------------------------------------------------------------------------
// Mock API and auth
// ---------------------------------------------------------------------------

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
import { getNotes, getNote } from '../api/notes.js';
import { getTags } from '../api/tags.js';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('WorkspacePage Editor + Preview integration (TASK-007)', () => {
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
    getNote.mockResolvedValue({
      note: { id: 'note-1', title: 'My Note', body: '# Hello Markdown', folder_id: null, updated_at: '2026-03-20T10:00:00.000Z' },
    });
  });

  // -------------------------------------------------------------------------
  // AC-1: Editor panel is rendered in the workspace
  // -------------------------------------------------------------------------

  describe('editor panel presence', () => {
    it('renders the editor panel container in the workspace layout', () => {
      const { container } = renderWorkspacePage();
      expect(container.querySelector('[data-testid="editor-panel"]')).not.toBeNull();
    });

    it('renders the preview panel container in the workspace layout', () => {
      const { container } = renderWorkspacePage();
      expect(container.querySelector('[data-testid="preview-panel"]')).not.toBeNull();
    });

    it('renders the CodeMirror instance in the editor panel', () => {
      const { container } = renderWorkspacePage();
      expect(container.querySelector('[data-testid="codemirror-mock"]')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Selected note body flows to Editor and Preview
  // -------------------------------------------------------------------------

  describe('note body flows to Editor and Preview on selection', () => {
    it('passes the selected note body to the CodeMirror editor', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({
        notes: [{ id: 'note-1', title: 'My Note', updated_at: '2026-03-20T10:00:00.000Z', folder_id: null }],
      });

      const { container } = renderWorkspacePage();

      await waitFor(() => screen.getByText('My Note'));
      await user.click(screen.getByText('My Note'));

      await waitFor(() => {
        const cm = container.querySelector('[data-testid="codemirror-mock"]');
        expect(cm.defaultValue).toBe('# Hello Markdown');
      });
    });

    it('renders the note body as HTML in the preview panel after selection', async () => {
      const user = userEvent.setup();
      getNotes.mockResolvedValue({
        notes: [{ id: 'note-1', title: 'My Note', updated_at: '2026-03-20T10:00:00.000Z', folder_id: null }],
      });

      const { container } = renderWorkspacePage();

      await waitFor(() => screen.getByText('My Note'));
      await user.click(screen.getByText('My Note'));

      await waitFor(() => {
        const preview = container.querySelector('[data-testid="preview-panel"]');
        // The heading text should appear in the preview panel
        expect(preview.textContent).toContain('Hello Markdown');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Empty state: no note selected
  // -------------------------------------------------------------------------

  describe('empty state when no note is selected', () => {
    it('renders the editor panel with empty content when no note is active', () => {
      const { container } = renderWorkspacePage();
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      expect(cm).not.toBeNull();
      // Empty body defaults to empty string
      expect(cm.defaultValue).toBe('');
    });
  });
});
