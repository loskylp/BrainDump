/**
 * Unit tests for WorkspacePage search behavior (TASK-014, OBS-V014-02).
 *
 * Verifies:
 *   - When SearchBar fires onResults with results, the search results list
 *     is rendered in the sidebar (not the catalog).
 *   - When SearchBar fires onResults with an empty array (API returned zero
 *     matches), the "No notes found" message is shown (not the catalog).
 *   - When SearchBar fires onClear (query was cleared), the catalog is
 *     restored (searchResults set to null).
 *
 * SearchBar is mocked so tests can directly invoke onResults/onClear without
 * timing concerns. Notes API is mocked to avoid network calls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Capture the props the component passes to SearchBar so tests can invoke
// onResults and onClear directly.
// ---------------------------------------------------------------------------

let capturedSearchBarProps = {};

vi.mock('../components/Search/SearchBar.jsx', () => ({
  default: vi.fn((props) => {
    capturedSearchBarProps = props;
    return <div data-testid="search-bar-mock" />;
  }),
}));

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
// Mock hooks and API modules
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

import { useAuth } from '../hooks/useAuth.js';
import { getNotes } from '../api/notes.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  capturedSearchBarProps = {};

  useAuth.mockReturnValue({
    user: { id: '1', username: 'alice', email: 'alice@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
  getNotes.mockResolvedValue({ notes: [] });
});

function renderWorkspacePage() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspacePage search behavior (OBS-V014-02)', () => {
  it('shows search results list when onResults is called with non-empty results', async () => {
    renderWorkspacePage();

    const results = [
      { id: 'n1', title: 'PostgreSQL Guide', snippet: '<mark>PostgreSQL</mark> tips' },
    ];

    act(() => {
      capturedSearchBarProps.onResults(results);
    });

    expect(screen.getByTestId('search-results-list')).toBeDefined();
    expect(screen.queryByTestId('search-no-results')).toBeNull();
  });

  it('shows "No notes found" message when onResults is called with an empty array', async () => {
    renderWorkspacePage();

    act(() => {
      capturedSearchBarProps.onResults([]);
    });

    expect(screen.getByTestId('search-no-results')).toBeDefined();
    expect(screen.queryByTestId('search-results-list')).toBeNull();
  });

  it('restores the catalog (hides search panel) when onClear is called', async () => {
    renderWorkspacePage();

    // First put the sidebar into search mode with results
    act(() => {
      capturedSearchBarProps.onResults([
        { id: 'n1', title: 'A note', snippet: 'snippet' },
      ]);
    });
    expect(screen.getByTestId('search-results-list')).toBeDefined();

    // Now clear — catalog must be restored
    act(() => {
      capturedSearchBarProps.onClear();
    });

    expect(screen.queryByTestId('search-results-list')).toBeNull();
    expect(screen.queryByTestId('search-no-results')).toBeNull();
    // The Sidebar catalog is back — it contains the "New note" button
    expect(screen.getByRole('button', { name: /new note/i })).toBeDefined();
  });

  it('restores the catalog when onClear is called after an empty-results search', async () => {
    renderWorkspacePage();

    // Empty search results → shows "No notes found"
    act(() => {
      capturedSearchBarProps.onResults([]);
    });
    expect(screen.getByTestId('search-no-results')).toBeDefined();

    // Clear → catalog must be restored
    act(() => {
      capturedSearchBarProps.onClear();
    });

    expect(screen.queryByTestId('search-no-results')).toBeNull();
    expect(screen.getByRole('button', { name: /new note/i })).toBeDefined();
  });
});
