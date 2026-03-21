/**
 * Verifier Acceptance Tests — TASK-026: Export notes as Markdown
 * (Part 2 of 2: WorkspacePage Export button visibility and wiring)
 *
 * REQ-019: Export notes as Markdown
 *
 * Acceptance criteria covered:
 *   AC-5  Toolbar placement — Export button present alongside Save, History, Delete.
 *   AC-11 [VERIFIER-ADDED] Export button absent when no note is active
 *         (visibility / ownership guard — REQ-019: "Export is only available for
 *          the currently loaded note").
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports of the modules they replace
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

vi.mock('../utils/exportNote.js', () => ({
  exportNote: vi.fn(),
  sanitizeFilename: vi.fn((t) => t),
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn(({ value, onChange }) => (
    <textarea
      data-testid="codemirror-mock"
      defaultValue={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  )),
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
import { exportNote } from '../utils/exportNote.js';
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
      </Routes>
    </MemoryRouter>
  );
}

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
});

// ---------------------------------------------------------------------------
// AC-11 [VERIFIER-ADDED]: Export button absent when no note is active
// REQ-019: "Export is only available for the currently loaded note"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-11 [VERIFIER-ADDED]: Export button visibility guard', () => {
  // Given: workspace with no active note
  // When: workspace is rendered
  // Then: data-testid="export-button" is not in the DOM

  it('does not render export-button when no note is active', async () => {
    getNotes.mockResolvedValue({ notes: [] });

    renderWorkspacePage();

    await waitFor(() => {
      expect(screen.queryByTestId('export-button')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-5: Toolbar placement — Export button alongside Save, History, Delete
// REQ-019 GWT: Given active note / When user views toolbar / Then Export button
//   is visible alongside Save, History, Delete
// ---------------------------------------------------------------------------

describe('REQ-019 AC-5: Export button in editor toolbar with active note', () => {
  function makeNote(overrides = {}) {
    return {
      id: 'note-26',
      title: 'Export Test Note',
      body: '# Hello\n\nworld',
      folder_id: null,
      updated_at: '2026-03-21T10:00:00.000Z',
      ...overrides,
    };
  }

  // Given: an authenticated user with an active note
  // When: they view the editor toolbar
  // Then: Export button is visible alongside Save, History, Delete

  it('renders export-button alongside Save, History, Delete when a note is active', async () => {
    const note = makeNote();
    getNotes.mockResolvedValue({
      notes: [{ id: note.id, title: note.title, updated_at: note.updated_at, folder_id: null }],
    });
    getNote.mockResolvedValue({ note });

    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Export Test Note'));
    await user.click(screen.getByText('Export Test Note'));

    await waitFor(() => {
      expect(screen.getByTestId('export-button')).toBeTruthy();
      expect(screen.getByTestId('save-button')).toBeTruthy();
      expect(screen.getByTestId('version-history-button')).toBeTruthy();
      expect(screen.getByTestId('delete-note-button')).toBeTruthy();
    });
  });

  // Given: an authenticated user with an active note
  // When: they click the Export button
  // Then: exportNote is called with the current title and body (not persisted state)

  it('clicking export-button calls exportNote with current title and body', async () => {
    const note = makeNote();
    getNotes.mockResolvedValue({
      notes: [{ id: note.id, title: note.title, updated_at: note.updated_at, folder_id: null }],
    });
    getNote.mockResolvedValue({ note });

    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Export Test Note'));
    await user.click(screen.getByText('Export Test Note'));
    await waitFor(() => screen.getByTestId('export-button'));

    await user.click(screen.getByTestId('export-button'));

    expect(exportNote).toHaveBeenCalledWith('Export Test Note', '# Hello\n\nworld');
  });
});
