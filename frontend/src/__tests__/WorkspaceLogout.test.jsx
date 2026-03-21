/**
 * TASK-004 -- Workspace logout button
 *
 * Verifies that the workspace sidebar includes a logout button that calls
 * the logout function from useAuth and navigates to /login.
 *
 * Updated by TASK-008: notes API mocked so the test remains unit-level
 * (WorkspacePage now calls getNotes on mount).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';

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
import { getNotes } from '../api/notes.js';
import { getTags } from '../api/tags.js';

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

describe('WorkspacePage logout', () => {
  let mockLogout;

  beforeEach(() => {
    mockLogout = vi.fn().mockResolvedValue(undefined);
    useAuth.mockReturnValue({
      user: { id: '1', username: 'alice', email: 'alice@example.com' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: mockLogout,
    });
    getNotes.mockResolvedValue({ notes: [] });
    getTags.mockResolvedValue({ tags: [] });
  });

  it('renders a logout button', () => {
    renderWorkspacePage();
    expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
  });

  it('calls logout and navigates to /login when logout button is clicked', async () => {
    const user = userEvent.setup();
    renderWorkspacePage();

    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeTruthy();
    });
  });
});
