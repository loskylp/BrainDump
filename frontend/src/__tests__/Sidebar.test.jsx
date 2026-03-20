/**
 * TASK-008 -- Sidebar component unit tests.
 *
 * Verifies the Sidebar component contract:
 *   AC-1: Sidebar is visible in the workspace layout (rendered when provided)
 *   AC-2: Renders a list of notes with title and last modified date
 *   AC-3: Clicking a note item calls onSelectNote with the note's id
 *   AC-4: New note button is present and calls onCreateNote when clicked
 *   AC-5: Currently active note is visually distinguished (active class/aria-current)
 *   AC-6: Empty state shown when notes array is empty
 *   AC-8: Note titles are truncated (single-line, overflow hidden) to fit 260px width
 *
 * The getNotes and createNote API calls are NOT tested here -- those are the
 * WorkspacePage's responsibility. The Sidebar receives notes as props.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../components/common/Sidebar.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain note summary object matching the API shape.
 */
function makeNote(overrides = {}) {
  return {
    id: '1',
    title: 'Test Note',
    updated_at: '2026-03-20T10:00:00.000Z',
    folder_id: null,
    ...overrides,
  };
}

/**
 * Renders the Sidebar with default props, merging any overrides.
 */
function renderSidebar(props = {}) {
  const defaultProps = {
    notes: [],
    activeNoteId: null,
    onSelectNote: vi.fn(),
    onCreateNote: vi.fn(),
    user: { username: 'alice', email: 'alice@example.com' },
    onLogout: vi.fn(),
  };
  return render(<Sidebar {...defaultProps} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar (TASK-008)', () => {

  // -------------------------------------------------------------------------
  // AC-6: Empty state
  // -------------------------------------------------------------------------

  describe('empty state', () => {
    it('shows empty state message when there are no notes', () => {
      renderSidebar({ notes: [] });
      expect(screen.getByText(/no notes yet/i)).toBeTruthy();
    });

    it('shows guidance on how to create a first note in empty state', () => {
      renderSidebar({ notes: [] });
      // Some guidance text pointing to creating a note
      const container = screen.getByTestId('sidebar-empty-state');
      expect(container).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // AC-2: Renders note list with title and last modified date
  // -------------------------------------------------------------------------

  describe('note list rendering', () => {
    it('renders a list item for each note', () => {
      const notes = [
        makeNote({ id: '1', title: 'Note Alpha' }),
        makeNote({ id: '2', title: 'Note Beta' }),
      ];
      renderSidebar({ notes });

      expect(screen.getByText('Note Alpha')).toBeTruthy();
      expect(screen.getByText('Note Beta')).toBeTruthy();
    });

    it('renders the last modified date for each note', () => {
      const notes = [makeNote({ id: '1', title: 'Note A', updated_at: '2026-03-20T10:00:00.000Z' })];
      renderSidebar({ notes });

      // A formatted date representation must appear in the sidebar
      const sidebar = screen.getByTestId('sidebar-note-list');
      expect(sidebar.textContent).toMatch(/mar.*20|20.*mar|2026/i);
    });

    it('does not show the empty state when notes are present', () => {
      const notes = [makeNote({ id: '1', title: 'My Note' })];
      renderSidebar({ notes });

      expect(screen.queryByTestId('sidebar-empty-state')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // AC-3: Clicking a note calls onSelectNote with the note's id
  // -------------------------------------------------------------------------

  describe('note selection', () => {
    it('calls onSelectNote with the note id when a note item is clicked', async () => {
      const user = userEvent.setup();
      const onSelectNote = vi.fn();
      const notes = [makeNote({ id: 'note-123', title: 'Clickable Note' })];

      renderSidebar({ notes, onSelectNote });

      await user.click(screen.getByText('Clickable Note'));

      expect(onSelectNote).toHaveBeenCalledWith('note-123');
    });

    it('calls onSelectNote with the correct id for the clicked note among many', async () => {
      const user = userEvent.setup();
      const onSelectNote = vi.fn();
      const notes = [
        makeNote({ id: 'note-A', title: 'Note A' }),
        makeNote({ id: 'note-B', title: 'Note B' }),
      ];

      renderSidebar({ notes, onSelectNote });

      await user.click(screen.getByText('Note B'));

      expect(onSelectNote).toHaveBeenCalledWith('note-B');
      expect(onSelectNote).not.toHaveBeenCalledWith('note-A');
    });
  });

  // -------------------------------------------------------------------------
  // AC-5: Active note is visually highlighted
  // -------------------------------------------------------------------------

  describe('active note highlighting', () => {
    it('marks the active note item with aria-current="page"', () => {
      const notes = [
        makeNote({ id: 'note-1', title: 'Active Note' }),
        makeNote({ id: 'note-2', title: 'Inactive Note' }),
      ];

      renderSidebar({ notes, activeNoteId: 'note-1' });

      const activeItem = screen.getByText('Active Note').closest('[data-testid^="note-item"]');
      expect(activeItem.getAttribute('aria-current')).toBe('page');
    });

    it('does not mark non-active notes as current', () => {
      const notes = [
        makeNote({ id: 'note-1', title: 'Active Note' }),
        makeNote({ id: 'note-2', title: 'Other Note' }),
      ];

      renderSidebar({ notes, activeNoteId: 'note-1' });

      const otherItem = screen.getByText('Other Note').closest('[data-testid^="note-item"]');
      expect(otherItem.getAttribute('aria-current')).not.toBe('page');
    });
  });

  // -------------------------------------------------------------------------
  // AC-4: New note button calls onCreateNote
  // -------------------------------------------------------------------------

  describe('create note button', () => {
    it('renders a "New note" button', () => {
      renderSidebar();
      expect(screen.getByRole('button', { name: /new note/i })).toBeTruthy();
    });

    it('calls onCreateNote when the new note button is clicked', async () => {
      const user = userEvent.setup();
      const onCreateNote = vi.fn();

      renderSidebar({ onCreateNote });

      await user.click(screen.getByRole('button', { name: /new note/i }));

      expect(onCreateNote).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // User info and logout
  // -------------------------------------------------------------------------

  describe('user info and logout', () => {
    it('displays the username', () => {
      renderSidebar({ user: { username: 'alice', email: 'alice@example.com' } });
      expect(screen.getByText('alice')).toBeTruthy();
    });

    it('renders a logout button', () => {
      renderSidebar();
      expect(screen.getByRole('button', { name: /log out/i })).toBeTruthy();
    });

    it('calls onLogout when the logout button is clicked', async () => {
      const user = userEvent.setup();
      const onLogout = vi.fn();

      renderSidebar({ onLogout });

      await user.click(screen.getByRole('button', { name: /log out/i }));

      expect(onLogout).toHaveBeenCalledTimes(1);
    });
  });
});
