/**
 * TASK-016 -- Verifies WorkspacePage renders WorkspaceLayout with three panels.
 * Updated by TASK-004 to wrap in MemoryRouter (WorkspacePage now uses useNavigate)
 * and mock useAuth (WorkspacePage now uses logout).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';

beforeEach(() => {
  useAuth.mockReturnValue({
    user: { id: '1', username: 'alice', email: 'alice@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
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

  it('renders placeholder text in panels', () => {
    const { container } = renderWorkspacePage();

    expect(container.textContent).toContain('Notes will appear here');
    expect(container.textContent).toContain('Select or create a note to start editing');
    expect(container.textContent).toContain('Preview will appear here');
  });
});
