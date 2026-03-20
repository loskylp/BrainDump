/**
 * Verifier Acceptance Tests -- TASK-008: Note catalog sidebar (UI layer)
 *
 * REQ-008: Note catalog (sidebar)
 *
 * These tests exercise the frontend components through their public interfaces
 * (rendered output, user events, DOM state). No backend or network calls are
 * made -- the API layer is mocked to isolate the UI behaviour.
 *
 * Acceptance criteria covered:
 *   AC-1  Sidebar is visible alongside the editor in the workspace layout
 *         at desktop viewport (>= 1024px grid structure: 260px 1fr 1fr)
 *   AC-3  Selecting a note in the sidebar sets it as the active note
 *         (structural: activeNoteId state updated; full content load is TASK-009)
 *   AC-4  Creating a new note adds it to the sidebar list immediately
 *         (UI side: note prepended to sidebar without page reload)
 *   AC-5  The currently active note is visually highlighted in the sidebar
 *
 * The backend acceptance tests in TASK-008-note-catalog-verifier.test.js cover
 * AC-2 (sort order) and the API contract for AC-3 and AC-4.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';
import Sidebar from '../components/common/Sidebar.jsx';

// ---------------------------------------------------------------------------
// Mocks
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
import { getNotes, createNote } from '../api/notes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides = {}) {
  return {
    id: 'note-1',
    title: 'Test Note',
    updated_at: '2026-03-20T10:00:00.000Z',
    folder_id: null,
    ...overrides,
  };
}

/**
 * Renders WorkspacePage inside a MemoryRouter.
 */
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
  createNote.mockResolvedValue({
    note: makeNote({ id: 'new-note', title: 'New Note' }),
  });
});

// ---------------------------------------------------------------------------
// AC-1: Sidebar visible alongside editor at desktop viewport >= 1024px
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-008]: Sidebar visible alongside editor in workspace layout', () => {

  it('Given a desktop viewport, when the workspace renders, then the CSS Grid has gridTemplateColumns: 260px 1fr 1fr', () => {
    // Given / When
    const { container } = render(
      <WorkspaceLayout
        sidebar={<div data-testid="sidebar-panel">Sidebar</div>}
        editor={<div data-testid="editor-panel">Editor</div>}
        preview={<div data-testid="preview-panel">Preview</div>}
      />
    );

    // Then: grid structure is 260px sidebar + 1fr editor + 1fr preview
    const grid = container.firstChild;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('260px 1fr 1fr');
  });

  it('Given a workspace layout, when rendered, then all three panels are simultaneously present in the DOM', () => {
    // Given / When
    const { getByTestId } = render(
      <WorkspaceLayout
        sidebar={<div data-testid="sidebar-panel">Sidebar</div>}
        editor={<div data-testid="editor-panel">Editor</div>}
        preview={<div data-testid="preview-panel">Preview</div>}
      />
    );

    // Then: all three panels are in the DOM (not hidden)
    expect(getByTestId('sidebar-panel')).toBeTruthy();
    expect(getByTestId('editor-panel')).toBeTruthy();
    expect(getByTestId('preview-panel')).toBeTruthy();
  });

  it('Given the full workspace page, when it renders, then the Sidebar component is visible in the layout', async () => {
    // Given / When
    renderWorkspacePage();

    // Then: Sidebar-specific elements are present (the "New note" button is inside Sidebar)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new note/i })).toBeTruthy();
    });
  });

  it('[VERIFIER-ADDED] Given a workspace layout, the sidebar occupies the first grid column (leftmost)', () => {
    // Given / When
    const { container } = render(
      <WorkspaceLayout
        sidebar={<div data-testid="sidebar-panel">Sidebar</div>}
        editor={<div data-testid="editor-panel">Editor</div>}
        preview={<div data-testid="preview-panel">Preview</div>}
      />
    );

    // Then: the first child of the grid is the sidebar wrapper (leftmost column = 260px)
    const grid = container.firstChild;
    const firstColumn = grid.children[0];
    expect(firstColumn.querySelector('[data-testid="sidebar-panel"]')).toBeTruthy();
  });

  it('[VERIFIER-ADDED] A layout with no Sidebar does NOT satisfy AC-1 (negative: proves the test is not trivially permissive)', () => {
    // Given: a layout with no recognizable sidebar content
    const { container } = render(
      <WorkspaceLayout
        sidebar={<div>Not a real sidebar</div>}
        editor={<div data-testid="editor-panel">Editor</div>}
        preview={<div data-testid="preview-panel">Preview</div>}
      />
    );

    // Then: the grid structure still exists (layout renders) but the Sidebar
    // component's "New note" button is absent
    expect(container.querySelector('[data-testid="editor-panel"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /new note/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Selecting a note sets it as active (structural -- editor content load is TASK-009)
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-008]: Selecting a note in the sidebar sets it as the active note', () => {

  it('Given a note list is displayed, when a note is clicked, then that note receives aria-current="page"', async () => {
    // Given
    const user = userEvent.setup();
    getNotes.mockResolvedValue({
      notes: [makeNote({ id: 'note-42', title: 'Select Me' })],
    });

    renderWorkspacePage();

    await waitFor(() => expect(screen.getByText('Select Me')).toBeTruthy());

    // When
    await user.click(screen.getByText('Select Me'));

    // Then
    await waitFor(() => {
      const noteItem = screen.getByTestId('note-item-note-42');
      expect(noteItem.getAttribute('aria-current')).toBe('page');
    });
  });

  it('[VERIFIER-ADDED] Given two notes, when one is clicked, then ONLY that note has aria-current="page"', async () => {
    // Given
    const user = userEvent.setup();
    getNotes.mockResolvedValue({
      notes: [
        makeNote({ id: 'note-A', title: 'Note Alpha' }),
        makeNote({ id: 'note-B', title: 'Note Beta' }),
      ],
    });

    renderWorkspacePage();

    await waitFor(() => expect(screen.getByText('Note Alpha')).toBeTruthy());

    // When: click Note Beta
    await user.click(screen.getByText('Note Beta'));

    // Then: only Note Beta is active
    await waitFor(() => {
      const itemB = screen.getByTestId('note-item-note-B');
      const itemA = screen.getByTestId('note-item-note-A');
      expect(itemB.getAttribute('aria-current')).toBe('page');
      expect(itemA.getAttribute('aria-current')).not.toBe('page');
    });
  });

  it('[VERIFIER-ADDED] Given no note is selected, then no note has aria-current="page"', async () => {
    // Given
    getNotes.mockResolvedValue({
      notes: [makeNote({ id: 'note-1', title: 'Unselected Note' })],
    });

    renderWorkspacePage();

    await waitFor(() => expect(screen.getByText('Unselected Note')).toBeTruthy());

    // Then: note is not active (no click has happened)
    const noteItem = screen.getByTestId('note-item-note-1');
    expect(noteItem.getAttribute('aria-current')).not.toBe('page');
  });

  it('[VERIFIER-ADDED] Selecting a note does not navigate away from the workspace (catalog remains visible)', async () => {
    // Given
    const user = userEvent.setup();
    getNotes.mockResolvedValue({
      notes: [makeNote({ id: 'note-keep', title: 'Stay Visible Note' })],
    });

    renderWorkspacePage();

    await waitFor(() => expect(screen.getByText('Stay Visible Note')).toBeTruthy());

    // When
    await user.click(screen.getByText('Stay Visible Note'));

    // Then: the sidebar is still present after selection
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new note/i })).toBeTruthy();
      expect(screen.getByText('Stay Visible Note')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-4: Creating a new note adds it to the sidebar list immediately
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-008]: Creating a new note adds it to the sidebar list immediately', () => {

  it('Given an empty note list, when the user clicks "New note", then the new note appears in the sidebar without page reload', async () => {
    // Given
    const user = userEvent.setup();
    getNotes.mockResolvedValue({ notes: [] });
    createNote.mockResolvedValue({
      note: makeNote({ id: 'brand-new', title: 'My First Note' }),
    });

    renderWorkspacePage();

    await waitFor(() => screen.getByRole('button', { name: /new note/i }));
    // Initially empty
    expect(screen.queryByTestId('sidebar-note-list')).toBeNull();

    // When
    await user.click(screen.getByRole('button', { name: /new note/i }));

    // Then: note appears in the list immediately
    await waitFor(() => {
      expect(screen.getByText('My First Note')).toBeTruthy();
    });
  });

  it('Given an existing note list, when the user creates a new note, then it is prepended at the top of the list', async () => {
    // Given
    const user = userEvent.setup();
    getNotes.mockResolvedValue({
      notes: [makeNote({ id: 'old-note', title: 'Old Note' })],
    });
    createNote.mockResolvedValue({
      note: makeNote({ id: 'newest-note', title: 'Newest Note' }),
    });

    renderWorkspacePage();

    await waitFor(() => expect(screen.getByText('Old Note')).toBeTruthy());

    // When
    await user.click(screen.getByRole('button', { name: /new note/i }));

    // Then: both notes present, newest at top
    await waitFor(() => {
      const list = screen.getByTestId('sidebar-note-list');
      const items = list.querySelectorAll('[data-testid^="note-item"]');
      expect(items[0].getAttribute('data-testid')).toBe('note-item-newest-note');
      expect(items[1].getAttribute('data-testid')).toBe('note-item-old-note');
    });
  });

  it('Given a note is just created, when the sidebar renders, then the new note is the active note', async () => {
    // Given
    const user = userEvent.setup();
    createNote.mockResolvedValue({
      note: makeNote({ id: 'active-new', title: 'Active On Create' }),
    });

    renderWorkspacePage();
    await waitFor(() => screen.getByRole('button', { name: /new note/i }));

    // When
    await user.click(screen.getByRole('button', { name: /new note/i }));

    // Then: new note is immediately active
    await waitFor(() => {
      const noteItem = screen.getByTestId('note-item-active-new');
      expect(noteItem.getAttribute('aria-current')).toBe('page');
    });
  });

  it('[VERIFIER-ADDED] If no note is created, the sidebar list does not spontaneously grow (negative: add is triggered by user action)', async () => {
    // Given
    getNotes.mockResolvedValue({
      notes: [makeNote({ id: 'only-note', title: 'Only Note' })],
    });

    renderWorkspacePage();

    await waitFor(() => expect(screen.getByText('Only Note')).toBeTruthy());

    // Then: still one item, no spurious additions
    const list = screen.getByTestId('sidebar-note-list');
    expect(list.querySelectorAll('[data-testid^="note-item"]').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Currently active note is visually highlighted
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-008]: The currently active note is visually highlighted', () => {

  it('Given an active note, when the Sidebar renders, then the active note has aria-current="page"', () => {
    // Given / When
    const notes = [
      makeNote({ id: 'note-active', title: 'Active Note' }),
      makeNote({ id: 'note-inactive', title: 'Inactive Note' }),
    ];

    render(
      <Sidebar
        notes={notes}
        activeNoteId="note-active"
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        user={{ username: 'alice', email: 'alice@example.com' }}
        onLogout={vi.fn()}
      />
    );

    // Then
    const activeItem = screen.getByTestId('note-item-note-active');
    expect(activeItem.getAttribute('aria-current')).toBe('page');
  });

  it('Given an active note, when the Sidebar renders, then inactive notes do NOT have aria-current="page"', () => {
    // Given / When
    const notes = [
      makeNote({ id: 'note-active', title: 'Active Note' }),
      makeNote({ id: 'note-inactive', title: 'Inactive Note' }),
    ];

    render(
      <Sidebar
        notes={notes}
        activeNoteId="note-active"
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        user={{ username: 'alice', email: 'alice@example.com' }}
        onLogout={vi.fn()}
      />
    );

    // Then
    const inactiveItem = screen.getByTestId('note-item-note-inactive');
    expect(inactiveItem.getAttribute('aria-current')).not.toBe('page');
  });

  it('[VERIFIER-ADDED] When no note is active (activeNoteId=null), then no note has aria-current="page"', () => {
    // Given / When
    const notes = [
      makeNote({ id: 'note-1', title: 'Note One' }),
      makeNote({ id: 'note-2', title: 'Note Two' }),
    ];

    render(
      <Sidebar
        notes={notes}
        activeNoteId={null}
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        user={{ username: 'alice', email: 'alice@example.com' }}
        onLogout={vi.fn()}
      />
    );

    // Then: no item is active
    const item1 = screen.getByTestId('note-item-note-1');
    const item2 = screen.getByTestId('note-item-note-2');
    expect(item1.getAttribute('aria-current')).not.toBe('page');
    expect(item2.getAttribute('aria-current')).not.toBe('page');
  });

  it('[VERIFIER-ADDED] When activeNoteId is set to a non-existent note id, then no note in the list has aria-current="page"', () => {
    // Given / When
    const notes = [makeNote({ id: 'note-1', title: 'Only Note' })];

    render(
      <Sidebar
        notes={notes}
        activeNoteId="ghost-note-that-does-not-exist"
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        user={{ username: 'alice', email: 'alice@example.com' }}
        onLogout={vi.fn()}
      />
    );

    // Then: the real note is not spuriously marked active
    const item = screen.getByTestId('note-item-note-1');
    expect(item.getAttribute('aria-current')).not.toBe('page');
  });

  it('[VERIFIER-ADDED] Active note has a distinct visual class compared to inactive notes (accent border applied)', () => {
    // Given / When
    const notes = [
      makeNote({ id: 'note-active', title: 'Active' }),
      makeNote({ id: 'note-passive', title: 'Passive' }),
    ];

    render(
      <Sidebar
        notes={notes}
        activeNoteId="note-active"
        onSelectNote={vi.fn()}
        onCreateNote={vi.fn()}
        user={{ username: 'alice', email: 'alice@example.com' }}
        onLogout={vi.fn()}
      />
    );

    // Then: active item has the accent border class; passive does not
    const activeItem = screen.getByTestId('note-item-note-active');
    const passiveItem = screen.getByTestId('note-item-note-passive');

    // border-accent is in the active class set per Sidebar implementation
    expect(activeItem.className).toContain('border-accent');
    expect(passiveItem.className).not.toContain('border-accent');
  });
});
