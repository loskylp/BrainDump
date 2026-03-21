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
 *   - activeNote: full note object fetched from GET /api/notes/:id (null if none selected)
 *   - editorTitle: the current title string in the title input (TASK-009).
 *     Initialised from activeNote.title when a note is opened; updated on every title keystroke.
 *   - editorBody: the current content of the editor (string). Initialised from
 *     activeNote.body when a note is opened; updated on every keystroke.
 *     This is the single source of truth for the editor and preview panels.
 *
 * Data flow:
 *   Mount -> getNotes() -> populate notes state in Sidebar
 *   Sidebar.onSelectNote -> set activeNoteId -> useEffect fires -> getNote(activeNoteId) -> set activeNote -> set editorTitle + editorBody
 *   Sidebar.onCreateNote -> createNote() -> prepend to notes state -> set activeNoteId
 *   Title input.onChange -> update editorTitle
 *   Editor.onChange -> update editorBody -> Preview re-renders with new value (AC-2, FF-D02)
 *   Save button click or Cmd/Ctrl+S -> updateNote(activeNoteId, { title, body }) (TASK-009)
 *   editorBody change -> useAutoSave debounce timer resets (TASK-012)
 *   editorBody change -> useVersionTimer idle timer resets (TASK-013)
 *
 * Hook wiring:
 *   - useAuth: provides user context and logout function (TASK-004)
 *   - useAutoSave: wired to editorBody and activeNoteId (TASK-012)
 *   - useVersionTimer: wired to editorBody and activeNoteId (TASK-013)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';
import Sidebar from '../components/common/Sidebar.jsx';
import Editor from '../components/editor/Editor.jsx';
import Preview from '../components/editor/Preview.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useAutoSave } from '../hooks/useAutoSave.js';
import { useVersionTimer } from '../hooks/useVersionTimer.js';
import VersionHistory from '../components/editor/VersionHistory.jsx';
import { getNotes, createNote, getNote, updateNote, deleteNote } from '../api/notes.js';

/**
 * @returns {JSX.Element}
 *
 * @precondition User is authenticated (ProtectedRoute ensures this)
 * @postcondition WorkspaceLayout renders with sidebar, Editor, and Preview panels
 * @postcondition Sidebar displays all user notes fetched from GET /api/notes on mount
 * @postcondition Selecting a note triggers GET /api/notes/:id and loads title and body into the editor area
 * @postcondition Editor.onChange updates editorBody; Preview re-renders with the new value
 * @postcondition Creating a note prepends it to the sidebar list and sets it as active
 * @postcondition Save button and Cmd/Ctrl+S send title and body to PUT /api/notes/:id (TASK-009)
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
   * @type {[{id: string, title: string, body: string}|null, Function]}
   */
  const [activeNote, setActiveNote] = useState(null);

  /**
   * Current title of the note as displayed in the title input field.
   * Initialised from activeNote.title when a note is opened.
   * Updated on every title keystroke via handleTitleChange.
   * @type {[string, Function]}
   */
  const [editorTitle, setEditorTitle] = useState('');

  /**
   * Current content of the editor (Markdown source string).
   * Initialised from activeNote.body when a note is opened.
   * Updated on every keystroke via handleEditorChange.
   * This is the single source of truth for both the Editor and Preview panels.
   * @type {[string, Function]}
   */
  const [editorBody, setEditorBody] = useState('');

  // ---------------------------------------------------------------------------
  // Auto-save hook (TASK-012)
  // ---------------------------------------------------------------------------

  /**
   * Memoised content object for useAutoSave. Changes identity only when
   * editorTitle or editorBody actually change, preventing unnecessary
   * debounce timer resets.
   */
  const autoSaveContent = useMemo(
    () => ({ title: editorTitle, body: editorBody }),
    [editorTitle, editorBody]
  );

  const { status: saveStatus } = useAutoSave({
    noteId: activeNoteId,
    content: autoSaveContent,
    onSave: useCallback((noteId, title) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, title } : n))
      );
    }, []),
  });

  // ---------------------------------------------------------------------------
  // Version timer hook (TASK-013)
  // ---------------------------------------------------------------------------

  /** Whether the version history panel is open. */
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  useVersionTimer({
    noteId: activeNoteId,
    contentKey: editorBody,
  });

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
      }
    }

    loadNotes();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load note content when activeNoteId changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null);
      setEditorTitle('');
      setEditorBody('');
      return;
    }

    let cancelled = false;

    /**
     * Fetches the full note content from GET /api/notes/:id and stores it in
     * activeNote state. Initialises editorTitle and editorBody from the fetched
     * note so the title input and Editor display persisted content immediately
     * after selection (AC-5).
     * Silently ignores the result if the component unmounted or the active note
     * changed again before the fetch resolved (cancelled flag).
     */
    async function loadNote() {
      try {
        const data = await getNote(activeNoteId);
        if (!cancelled) {
          setActiveNote(data.note);
          setEditorTitle(data.note.title || '');
          setEditorBody(data.note.body || '');
        }
      } catch {
        // Note not found or network error — leave editor empty.
        if (!cancelled) {
          setActiveNote(null);
          setEditorTitle('');
          setEditorBody('');
        }
      }
    }

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [activeNoteId]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Cmd+S / Ctrl+S triggers save (AC-3)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    /**
     * Handles the global keydown event to intercept Cmd+S (macOS) and
     * Ctrl+S (Windows/Linux). When a note is active, calls handleSave.
     * Prevents the browser's default "Save page" dialog.
     *
     * @param {KeyboardEvent} e
     */
    function handleKeyDown(e) {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (activeNoteId) {
          handleSave();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId, editorTitle, editorBody]);

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

  /**
   * Updates editorTitle when the user edits the title input field.
   *
   * @param {string} newTitle - New title string from the input
   */
  const handleTitleChange = useCallback((newTitle) => {
    setEditorTitle(newTitle);
  }, []);

  /**
   * Updates editorBody on every keystroke from the Editor component.
   * This is intentionally unthrottled so the Preview re-renders immediately
   * without debounce (FF-D02: preview update < 100ms).
   *
   * @param {string} newValue - Full Markdown source after the edit
   */
  const handleEditorChange = useCallback((newValue) => {
    setEditorBody(newValue);
  }, []);

  /**
   * Sends the current title and body to PUT /api/notes/:id (manual save path).
   *
   * This is the TASK-009 manual save — not the auto-save path (TASK-012).
   * Does NOT create a NoteVersion entry (that is versionService's job, ADR-004).
   * Silently ignores save errors in iteration 1; error surface is TASK-012.
   */
  async function handleSave() {
    if (!activeNoteId) {
      return;
    }
    try {
      await updateNote(activeNoteId, { title: editorTitle, body: editorBody });
      setNotes((prev) =>
        prev.map((n) => (n.id === activeNoteId ? { ...n, title: editorTitle } : n))
      );
    } catch {
      // Error state surfaced in a future iteration.
    }
  }

  /**
   * Deletes the currently active note after user confirmation (AC-2, AC-5).
   *
   * Presents a browser-native confirm() dialog to prevent accidental deletion.
   * If confirmed: calls DELETE /api/notes/:id, removes the note from the sidebar
   * list, and clears the editor (AC-4). If cancelled: no action taken (AC-5).
   *
   * @precondition activeNoteId is not null
   * @postcondition On confirm: note removed from sidebar, editor cleared, API called
   * @postcondition On cancel: no state change, no API call
   */
  const handleDeleteNote = useCallback(async () => {
    if (!activeNoteId) {
      return;
    }

    const noteTitle = editorTitle || 'Untitled';
    const confirmed = window.confirm(
      `Are you sure you want to delete "${noteTitle}"? This will permanently remove the note and all its version history.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteNote(activeNoteId);
      setNotes((prev) => prev.filter((n) => n.id !== activeNoteId));
      setActiveNoteId(null);
      setActiveNote(null);
      setEditorTitle('');
      setEditorBody('');
    } catch {
      // Error state surfaced in a future iteration.
    }
  }, [activeNoteId, editorTitle]);

  /**
   * Toggles the version history panel visibility (TASK-013 AC-10).
   */
  const handleToggleVersionHistory = useCallback(() => {
    setShowVersionHistory((prev) => !prev);
  }, []);

  /**
   * Handles restoration from the VersionHistory panel (TASK-013 AC-8).
   * Updates the editor content with the restored version's title and body.
   *
   * @param {{ title: string, body: string }} restoredContent
   */
  const handleVersionRestore = useCallback((restoredContent) => {
    setEditorTitle(restoredContent.title);
    setEditorBody(restoredContent.body);
    setShowVersionHistory(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  /**
   * Renders the editor area: a title input, the CodeMirror editor, and a Save
   * button. The title input is a plain text input above the editor. The Save
   * button is visible only when a note is active (AC-3).
   *
   * @returns {JSX.Element}
   */
  function renderEditorPanel() {
    return (
      <div className="flex flex-col h-full">
        {activeNoteId && (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg-editor">
              <input
                data-testid="note-title-input"
                type="text"
                value={editorTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Note title"
                className="flex-1 bg-transparent text-gray-100 font-mono text-sm outline-none placeholder-gray-500"
              />
              <span
                data-testid="save-status"
                className={`text-xs font-mono ${
                  saveStatus === 'error'
                    ? 'text-red-400'
                    : saveStatus === 'saving'
                      ? 'text-yellow-400'
                      : saveStatus === 'saved'
                        ? 'text-green-400'
                        : 'text-text-secondary'
                }`}
              >
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'error' && 'Error'}
              </span>
              <button
                data-testid="save-button"
                onClick={handleSave}
                className="px-3 py-1 text-xs font-mono text-text-primary bg-bg-secondary border border-border hover:bg-border transition-colors"
              >
                Save
              </button>
              <button
                data-testid="version-history-button"
                onClick={handleToggleVersionHistory}
                className="px-3 py-1 text-xs font-mono text-text-primary bg-bg-secondary border border-border hover:bg-border transition-colors"
              >
                History
              </button>
              <button
                data-testid="delete-note-button"
                onClick={handleDeleteNote}
                className="px-3 py-1 text-xs font-mono text-red-400 bg-bg-secondary border border-border hover:bg-red-900 hover:text-red-200 transition-colors"
              >
                Delete
              </button>
            </div>
          </>
        )}
        <div className="flex-1 overflow-hidden border-r border-border">
          <Editor
            value={editorBody}
            onChange={handleEditorChange}
          />
        </div>
      </div>
    );
  }

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
      editor={renderEditorPanel()}
      preview={
        showVersionHistory && activeNoteId ? (
          <VersionHistory
            noteId={activeNoteId}
            onClose={handleToggleVersionHistory}
            onRestore={handleVersionRestore}
          />
        ) : (
          <Preview value={editorBody} />
        )
      }
    />
  );
}

export default WorkspacePage;
