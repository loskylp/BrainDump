/**
 * WorkspacePage component.
 *
 * The authenticated user's primary workspace. Composes the three-panel layout
 * (WorkspaceLayout) with the note catalog (Sidebar), Markdown editor (Editor),
 * and live preview (Preview). Owns the top-level note selection and content state.
 *
 * Authentication: user is guaranteed authenticated by ProtectedRoute (TASK-004).
 *
 * State managed by this page:
 *   - notes: array of all user note summaries (for the sidebar catalog, TASK-008)
 *   - activeNoteId: UUID of the currently open note (null if none selected)
 *   - content: { title, body } of the currently open note (for editor and preview)
 *
 * Hook wiring:
 *   - useAuth: provides user context and logout function (TASK-004)
 *   - useAutoSave: wired to content and activeNoteId (TASK-012)
 *   - useVersionTimer: wired to content and activeNoteId (TASK-013)
 *
 * Data flow:
 *   Mount -> getNotes() -> populate notes state in Sidebar
 *   Sidebar.onSelectNote -> set activeNoteId -> useEffect fires -> getNote(activeNoteId) -> set activeNote -> Editor renders body
 *   Sidebar.onCreateNote -> createNote() -> prepend to notes state -> set activeNoteId
 *   Editor.onChange -> update content state -> Preview re-renders
 *   content change -> useAutoSave debounce timer resets
 *   content change -> useVersionTimer idle timer resets
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';
import Sidebar from '../components/common/Sidebar.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { getNotes, createNote, getNote } from '../api/notes.js';

/**
 * @returns {JSX.Element}
 *
 * @precondition User is authenticated (ProtectedRoute ensures this)
 * @postcondition WorkspaceLayout renders with sidebar, editor area, and preview placeholder
 * @postcondition Sidebar displays all user notes fetched from GET /api/notes on mount
 * @postcondition Selecting a note triggers GET /api/notes/:id and renders body in the editor area
 * @postcondition Creating a note prepends it to the sidebar list and sets it as active
 */
function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /** @type {[Array<{id: string, title: string, updated_at: string, folder_id: string|null}>, Function]} */
  const [notes, setNotes] = useState([]);

  /** @type {[string|null, Function]} UUID of the note currently open in the editor */
  const [activeNoteId, setActiveNoteId] = useState(null);

  /**
   * Full content of the currently open note fetched from GET /api/notes/:id.
   * Null when no note is selected or the fetch has not yet resolved.
   * @type {[{title: string, body: string}|null, Function]}
   */
  const [activeNote, setActiveNote] = useState(null);

  // ---------------------------------------------------------------------------
  // Load notes on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    /**
     * Fetches the user's note list from the API and populates the sidebar.
     * Silently ignores errors if the component has unmounted before the fetch
     * resolves (cancelled flag).
     */
    async function loadNotes() {
      try {
        const data = await getNotes();
        if (!cancelled) {
          setNotes(data.notes);
        }
      } catch {
        // Network or auth errors are not surfaced here in iteration 1.
        // TASK-009 will add error state wiring.
      }
    }

    loadNotes();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load note content when activeNoteId changes (AC-3)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null);
      return;
    }

    let cancelled = false;

    /**
     * Fetches the full note content from GET /api/notes/:id and stores it in
     * activeNote state so the editor area can display the title and body.
     * Silently ignores the result if the component unmounted or the active note
     * changed again before the fetch resolved (cancelled flag).
     */
    async function loadNote() {
      try {
        const data = await getNote(activeNoteId);
        if (!cancelled) {
          setActiveNote(data.note);
        }
      } catch {
        // Note not found or network error — leave activeNote as null.
        if (!cancelled) {
          setActiveNote(null);
        }
      }
    }

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [activeNoteId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * Calls the logout API and navigates to /login.
   * Navigates regardless of whether the logout API call succeeds to ensure
   * the user is always returned to the login page.
   */
  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }

  /**
   * Sets the given note as the active note in the editor.
   * The activeNoteId change triggers the note-content useEffect which calls
   * getNote(noteId) and stores the result in activeNote state.
   *
   * @param {string} noteId - UUID of the note to open
   */
  const handleSelectNote = useCallback((noteId) => {
    setActiveNoteId(noteId);
  }, []);

  /**
   * Creates a new blank note via the API, prepends it to the sidebar list,
   * and sets it as the active note so the user can begin editing immediately.
   *
   * Prepending (not appending) keeps the newest note at the top of the list,
   * consistent with the updated_at DESC sort order.
   */
  const handleCreateNote = useCallback(async () => {
    try {
      const data = await createNote({ title: '' });
      const newNote = data.note;
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
    } catch {
      // Error state surfaced in a future iteration.
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <WorkspaceLayout
      sidebar={
        <Sidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          user={user}
          onLogout={handleLogout}
        />
      }
      editor={
        <div className="p-4 text-text-muted font-mono text-sm">
          {/* TASK-007: Editor component replaces this placeholder */}
          {activeNote
            ? <p>{activeNote.body}</p>
            : <p>Select or create a note to start editing</p>
          }
        </div>
      }
      preview={
        <div className="p-4 text-text-secondary font-sans text-sm">
          {/* TASK-007: Preview component replaces this placeholder */}
          <p className="text-text-muted">Preview will appear here</p>
        </div>
      }
    />
  );
}

export default WorkspacePage;
