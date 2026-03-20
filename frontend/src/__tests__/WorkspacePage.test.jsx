/**
 * TASK-016 -- Verifies WorkspacePage renders WorkspaceLayout with three panels.
 * Updated by TASK-004 to wrap in MemoryRouter (WorkspacePage now uses useNavigate)
 * and mock useAuth (WorkspacePage now uses logout).
 * Updated by TASK-008: sidebar placeholder replaced by Sidebar component;
 * notes API is mocked so the test remains unit-level (no network calls).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

// Mock notes API so mount does not trigger real fetch calls
vi.mock('../api/notes.js', () => ({
  getNotes: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';
import { getNotes } from '../api/notes.js';

beforeEach(() => {
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

describe('WorkspacePage', () => {
  it('renders the workspace layout with three panel placeholders', () => {
    const { container } = renderWorkspacePage();

    // Should render the grid container
    const grid = container.firstChild;
    expect(grid).toBeTruthy();
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('260px 1fr 1fr');

    // Should have three panel divs
    expect(grid.children.length).toBe(3);
  });

  it('renders placeholder text in editor and preview panels', () => {
    const { container } = renderWorkspacePage();

    // The sidebar placeholder ("Notes will appear here") was replaced by the
    // Sidebar component in TASK-008. Editor and preview remain as placeholders
    // until TASK-007 replaces them.
    expect(container.textContent).toContain('Select or create a note to start editing');
    expect(container.textContent).toContain('Preview will appear here');
  });

  it('renders the Sidebar component in the sidebar panel', () => {
    const { container } = renderWorkspacePage();

    // TASK-008: Sidebar component is now rendered (not a placeholder)
    // Verified by the presence of the "New note" button from the Sidebar
    expect(container.textContent).toContain('New note');
  });
});
