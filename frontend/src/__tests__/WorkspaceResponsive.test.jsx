/**
 * Integration tests for responsive workspace behaviour (TASK-018).
 *
 * Tests exercise the WorkspacePage + WorkspaceLayout + HamburgerToggle
 * integration through user interactions. All network calls are mocked.
 *
 * Note on viewport testing: Vitest/jsdom does not have a real viewport.
 * Tests verify state-driven behaviour (sidebarOpen, activePanel) and the
 * presence of correct responsive Tailwind classes rather than simulating
 * viewport resize. Breakpoint-driven CSS visibility is verified at the
 * class level, not by measuring rendered dimensions.
 *
 * Covers:
 *   - Hamburger toggle opens/closes the sidebar overlay (sidebarOpen state)
 *   - Clicking backdrop closes sidebar overlay
 *   - Tab bar switches between panels on mobile (activePanel state)
 *   - Selecting a note on mobile switches to editor panel
 *   - Root container has overflow-x-hidden class (no horizontal scrollbar)
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
import { getNotes, getNote } from '../api/notes.js';
import { getTags } from '../api/tags.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides = {}) {
  return {
    id: 'note-1',
    title: 'Test Note',
    updated_at: '2026-03-20T10:00:00.000Z',
    folder_id: null,
    body: '',
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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  useAuth.mockReturnValue({
    user: { id: 'user-1', username: 'alice', email: 'alice@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });

  getNotes.mockResolvedValue({ notes: [] });
  getTags.mockResolvedValue({ tags: [] });
  getNote.mockResolvedValue({ note: makeNote() });
});

// ---------------------------------------------------------------------------
// Hamburger toggle
// ---------------------------------------------------------------------------

describe('HamburgerToggle integration', () => {
  it('hamburger button is present in the rendered workspace', async () => {
    renderWorkspacePage();

    // The HamburgerToggle renders with aria-label "Toggle sidebar" when closed
    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(toggle).toBeTruthy();
  });

  it('clicking the hamburger button switches aria-label to "Close sidebar"', async () => {
    const user = userEvent.setup();
    renderWorkspacePage();

    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    await user.click(toggle);

    // After clicking, sidebarOpen becomes true; aria-label changes
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeTruthy();
  });

  it('clicking the hamburger button again closes the sidebar', async () => {
    const user = userEvent.setup();
    renderWorkspacePage();

    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    await user.click(toggle); // open
    await user.click(screen.getByRole('button', { name: 'Close sidebar' })); // close

    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

describe('Sidebar backdrop integration', () => {
  it('backdrop is not present when sidebar is closed', () => {
    const { container } = renderWorkspacePage();

    expect(container.querySelector('[data-testid="sidebar-backdrop"]')).toBeNull();
  });

  it('backdrop appears when sidebar is opened via hamburger toggle', async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspacePage();

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    expect(container.querySelector('[data-testid="sidebar-backdrop"]')).toBeTruthy();
  });

  it('clicking the backdrop closes the sidebar overlay', async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspacePage();

    // Open the sidebar first
    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(container.querySelector('[data-testid="sidebar-backdrop"]')).toBeTruthy();

    // Click the backdrop to close
    const backdrop = container.querySelector('[data-testid="sidebar-backdrop"]');
    backdrop.click();

    // Sidebar should be closed — backdrop gone, toggle shows "Toggle sidebar"
    await waitFor(() => {
      expect(container.querySelector('[data-testid="sidebar-backdrop"]')).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Mobile tab bar panel switching
// ---------------------------------------------------------------------------

describe('Mobile tab bar integration', () => {
  it('tab bar is rendered in the workspace', () => {
    const { container } = renderWorkspacePage();

    const tabBar = container.querySelector('[data-testid="mobile-tab-bar"]');
    expect(tabBar).toBeTruthy();
  });

  it('tab bar has md:hidden class so it hides on tablet/desktop breakpoints', () => {
    const { container } = renderWorkspacePage();

    const tabBar = container.querySelector('[data-testid="mobile-tab-bar"]');
    expect(tabBar.className).toContain('md:hidden');
  });

  it('"Edit" tab is active by default (editor is the default panel)', () => {
    renderWorkspacePage();

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    expect(editBtn.className).toContain('border-b-2');
  });

  it('clicking "Preview" tab makes Preview the active panel', async () => {
    const user = userEvent.setup();
    renderWorkspacePage();

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    const previewBtn = screen.getByRole('button', { name: 'Preview' });
    expect(previewBtn.className).toContain('border-b-2');
  });

  it('clicking "Notes" tab makes sidebar the active panel', async () => {
    const user = userEvent.setup();
    renderWorkspacePage();

    await user.click(screen.getByRole('button', { name: 'Notes' }));

    const notesBtn = screen.getByRole('button', { name: 'Notes' });
    expect(notesBtn.className).toContain('border-b-2');
  });
});

// ---------------------------------------------------------------------------
// Note selection on mobile switches to editor
// ---------------------------------------------------------------------------

describe('Note selection on mobile', () => {
  it('selecting a note switches the active panel to editor', async () => {
    const user = userEvent.setup();
    getNotes.mockResolvedValue({
      notes: [makeNote({ id: 'note-abc', title: 'My Note' })],
    });

    renderWorkspacePage();

    // Switch to Notes panel first
    await user.click(screen.getByRole('button', { name: 'Notes' }));
    expect(screen.getByRole('button', { name: 'Notes' }).className).toContain('border-b-2');

    // Wait for note list to load and click the note
    await waitFor(() => expect(screen.getByText('My Note')).toBeTruthy());
    await user.click(screen.getByText('My Note'));

    // After selection, Edit tab should be active
    await waitFor(() => {
      const editBtn = screen.getByRole('button', { name: 'Edit' });
      expect(editBtn.className).toContain('border-b-2');
    });
  });
});

// ---------------------------------------------------------------------------
// No horizontal scrollbar (overflow-x-hidden class presence)
// ---------------------------------------------------------------------------

describe('Overflow prevention (AC-4)', () => {
  it('workspace grid container has overflow-x-hidden class', () => {
    const { container } = renderWorkspacePage();

    const grid = container.querySelector('[data-testid="mobile-tab-bar"]')?.parentElement;
    expect(grid).toBeTruthy();
    expect(grid.className).toContain('overflow-x-hidden');
  });
});
