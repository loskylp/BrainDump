/**
 * TASK-016 -- Verifies WorkspacePage renders WorkspaceLayout with three panels.
 * Updated by TASK-004 to wrap in MemoryRouter (WorkspacePage now uses useNavigate)
 * and mock useAuth (WorkspacePage now uses logout).
 * Updated by TASK-008: sidebar placeholder replaced by Sidebar component;
 * notes API is mocked so the test remains unit-level (no network calls).
 * Updated by TASK-007: editor and preview placeholders replaced by Editor and
 * Preview components. @uiw/react-codemirror is mocked so CM6 DOM APIs are not
 * required in the jsdom test environment.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// Mock CodeMirror to avoid jsdom incompatibility with CM6 DOM APIs
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

    // TASK-018: WorkspacePage now wraps WorkspaceLayout in an outer div for the
    // HamburgerToggle positioning. Find the grid via inline style query.
    const grid = container.querySelector('[style*="grid"]');
    expect(grid).toBeTruthy();
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('260px 1fr 1fr');

    // TASK-018: grid now contains additional children for the mobile tab bar and
    // the sidebar overlay element. Verify at least 3 children are present.
    expect(grid.children.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the Editor and Preview components (not placeholder text) in the editor and preview panels', () => {
    const { container } = renderWorkspacePage();

    // TASK-007: placeholder text is replaced by the Editor component (CodeMirror)
    // and the Preview component (markdown-it). The editor panel has the
    // data-testid="editor-panel" wrapper and contains the mocked CodeMirror.
    // The preview panel has data-testid="preview-panel".
    expect(container.querySelector('[data-testid="editor-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="preview-panel"]')).not.toBeNull();

    // The placeholder strings must no longer appear
    expect(container.textContent).not.toContain('Select or create a note to start editing');
    expect(container.textContent).not.toContain('Preview will appear here');
  });

  it('renders the Sidebar component in the sidebar panel', () => {
    const { container } = renderWorkspacePage();

    // TASK-008: Sidebar component is now rendered (not a placeholder)
    // Verified by the presence of the "New note" button from the Sidebar
    expect(container.textContent).toContain('New note');
  });
});
