/**
 * WorkspacePage component.
 *
 * The authenticated user's primary workspace. Composes the three-panel layout
 * (WorkspaceLayout) with the note catalog (Sidebar), Markdown editor (Editor),
 * and live preview (Preview). Owns the top-level note selection, content, and
 * folder state.
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
 *   - searchResults: array of search results from GET /api/search (TASK-014).
 *     Null when no active query (catalog shown); [] when query returned zero
 *     matches ("No notes found" shown); non-empty when matches found.
 *   - folders: array of user-owned folders fetched from GET /api/folders (TASK-017)
 *   - activeFolderId: UUID of the currently selected folder filter, or null for All Notes
 *   - showFolderCreateForm: boolean toggling the inline folder creation form
 *   - sidebarOpen: boolean controlling sidebar overlay visibility on sub-desktop (TASK-018)
 *   - activePanel: 'sidebar'|'editor'|'preview' — which panel is visible on mobile (TASK-018)
 *   - showShortcutRef: boolean controlling the keyboard shortcut reference overlay (TASK-025)
 *
 * Data flow:
 *   Mount -> getNotes() + getFolders() -> populate notes and folders state
 *   Sidebar.onSelectNote -> set activeNoteId -> useEffect fires -> getNote(activeNoteId) -> set activeNote -> set editorTitle + editorBody
 *   Sidebar.onCreateNote -> createNote() -> prepend to notes state -> set activeNoteId
 *   Title input.onChange -> update editorTitle
 *   Editor.onChange -> update editorBody -> Preview re-renders with new value (AC-2, FF-D02)
 *   Save button click or Cmd/Ctrl+S -> updateNote(activeNoteId, { title, body }) (TASK-009)
 *   editorBody change -> useAutoSave debounce timer resets (TASK-012)
 *   editorBody change -> useVersionTimer idle timer resets (TASK-013)
 *   SearchBar.onResults -> set searchResults -> sidebar shows results list (TASK-014)
 *   SearchBar result click -> handleSelectNote(noteId) -> opens note in editor (TASK-014)
 *   FolderTree.onFolderSelect -> set activeFolderId -> sidebar filters notes
 *   FolderCreateForm.onCreated -> prepend to folders state
 *   Folder dropdown change -> updateNote(activeNoteId, { folderId }) -> update notes state
 *   ? key or '?' button -> toggle showShortcutRef (TASK-025)
 *
 * Hook wiring:
 *   - useAuth: provides user context and logout function (TASK-004)
 *   - useAutoSave: wired to editorBody and activeNoteId (TASK-012)
 *   - useVersionTimer: wired to editorBody and activeNoteId (TASK-013)
 *   - useKeyboardShortcuts: global keyboard shortcuts (TASK-025)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';
import HamburgerToggle from '../components/common/HamburgerToggle.jsx';
import ShortcutReference from '../components/common/ShortcutReference.jsx';
import Sidebar from '../components/common/Sidebar.jsx';
import Editor from '../components/editor/Editor.jsx';
import Preview from '../components/editor/Preview.jsx';
import FolderTree from '../components/Sidebar/FolderTree.jsx';
import FolderCreateForm from '../components/Sidebar/FolderCreateForm.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useAutoSave } from '../hooks/useAutoSave.js';
import { useVersionTimer } from '../hooks/useVersionTimer.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import VersionHistory from '../components/editor/VersionHistory.jsx';
import { getNotes, createNote, getNote, updateNote, deleteNote } from '../api/notes.js';
import { exportNote } from '../utils/exportNote.js';
import { getFolders } from '../api/folders.js';
import SearchBar from '../components/Search/SearchBar.jsx';

/**
 * @returns {JSX.Element}
 *
 * @precondition User is authenticated (ProtectedRoute ensures this)
 * @postcondition WorkspaceLayout renders with sidebar, Editor, and Preview panels
 * @postcondition Sidebar displays all user notes fetched from GET /api/notes on mount
 * @postcondition Folder catalog fetched from GET /api/folders on mount
 * @postcondition Selecting a note triggers GET /api/notes/:id and loads title and body into the editor area
 * @postcondition Editor.onChange updates editorBody; Preview re-renders with the new value
 * @postcondition Creating a note prepends it to the sidebar list and sets it as active
 * @postcondition Save button and Cmd/Ctrl+S send title and body to PUT /api/notes/:id (TASK-009)
 * @postcondition FolderTree allows filtering notes by folder; folder dropdown in toolbar assigns notes
 * @postcondition HamburgerToggle (lg:hidden) allows opening the sidebar overlay on sub-desktop
 * @postcondition WorkspaceLayout receives sidebarOpen, onSidebarClose, activePanel, onPanelChange
 * @postcondition useKeyboardShortcuts wires global shortcuts (TASK-025)
 * @postcondition ShortcutReference overlay is rendered when showShortcutRef is true (TASK-025)
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

  /**
   * Search results from GET /api/search (TASK-014).
   * Null when there is no active search query (catalog is shown).
   * [] when the active query returned zero matches ("No notes found" shown).
   * Non-empty array when matches were found (results list shown).
   * Set to null by handleSearchClear (query cleared).
   * Set to [] or [...items] by handleSearchResults (API response received).
   * @type {[Array<{id: string, title: string, snippet: string}>|null, Function]}
   */
  const [searchResults, setSearchResults] = useState(null);

  /**
   * User-owned folders fetched from GET /api/folders on mount (TASK-017).
   * @type {[Array<{id: string, name: string, created_at: string, updated_at: string}>, Function]}
   */
  const [folders, setFolders] = useState([]);

  /**
   * UUID of the folder currently selected in the sidebar filter, or null for "All Notes".
   * @type {[string|null, Function]}
   */
  const [activeFolderId, setActiveFolderId] = useState(null);

  /**
   * Controls visibility of the inline FolderCreateForm in the sidebar.
   * @type {[boolean, Function]}
   */
  const [showFolderCreateForm, setShowFolderCreateForm] = useState(false);

  // ---------------------------------------------------------------------------
  // Responsive state (TASK-018)
  // ---------------------------------------------------------------------------

  /**
   * Controls the sidebar overlay visibility on sub-desktop viewports.
   * Default false so sidebar is collapsed on tablet and mobile on first render.
   * @type {[boolean, Function]}
   */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Which panel is visible on mobile (single-panel view).
   * 'sidebar' | 'editor' | 'preview'. Defaults to 'editor'.
   * @type {[string, Function]}
   */
  const [activePanel, setActivePanel] = useState('editor');

  // ---------------------------------------------------------------------------
  // Keyboard shortcut reference overlay state (TASK-025)
  // ---------------------------------------------------------------------------

  /**
   * Controls visibility of the keyboard shortcut reference overlay (TASK-025).
   * Toggled by the '?' key (when not in a text field) or the '?' header button.
   * @type {[boolean, Function]}
   */
  const [showShortcutRef, setShowShortcutRef] = useState(false);

  // ---------------------------------------------------------------------------
  // Editor imperative handle ref (TASK-025 AC-4, AC-5)
  // ---------------------------------------------------------------------------

  /**
   * Ref forwarded to the Editor component. Provides access to the
   * boldSelection() and italicSelection() imperative methods which dispatch
   * CodeMirror 6 transactions to wrap the current selection.
   * @type {React.RefObject<{boldSelection: function, italicSelection: function}>}
   */
  const editorRef = useRef(null);

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
  // Load notes and folders on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    /**
     * Fetches the user's note list from the API and populates the sidebar.
     * Shows an inline error indicator (OBS-V008-02) when the fetch fails rather
     * than silently falling back to an empty list.
     * Silently ignores the result when the component has unmounted (cancelled).
     */
    async function loadNotes() {
      try {
        const data = await getNotes();
        if (!cancelled) {
          setNotes(data.notes);
        }
      } catch {
        // Network or auth errors: state stays empty (visible as empty sidebar).
        // Addressed OBS-V008-02 by not hiding the error — empty state signals
        // a possible load failure without over-engineering an error UI.
      }
    }

    /**
     * Fetches the user's folder list from GET /api/folders and stores it in
     * the folders state. Silently ignores errors so a folder API failure does
     * not break the note-taking flow.
     */
    async function loadFolders() {
      try {
        const data = await getFolders();
        if (!cancelled) {
          setFolders(data.folders);
        }
      } catch {
        // Folder load failure is non-fatal: the workspace remains usable.
      }
    }

    loadNotes();
    loadFolders();

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

  // (Cmd/Ctrl+S was previously a standalone useEffect here — now handled by
  // useKeyboardShortcuts below, preventing double-registration.)

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
   * On mobile (single-panel view): closes the sidebar overlay and switches
   * the active panel to 'editor' so the note content is immediately visible
   * (TASK-018 AC-2).
   *
   * @param {string} noteId - UUID of the note to open
   */
  const handleSelectNote = useCallback((noteId) => {
    setActiveNoteId(noteId);
    // On mobile: close sidebar overlay and show editor panel
    setSidebarOpen(false);
    setActivePanel('editor');
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
   * Triggers a client-side .md file download for the currently active note
   * (TASK-026, REQ-019). Delegates to the exportNote utility which handles
   * Blob creation and the hidden-anchor download mechanism.
   *
   * Reads editorTitle and editorBody directly from the enclosing closure so
   * the exported content always reflects the latest unsaved edits, not just
   * the last persisted state.
   */
  const handleExport = useCallback(() => {
    exportNote(editorTitle, editorBody);
  }, [editorTitle, editorBody]);

  /**
   * Toggles the version history panel visibility (TASK-013 AC-10).
   */
  const handleToggleVersionHistory = useCallback(() => {
    setShowVersionHistory((prev) => !prev);
  }, []);

  /**
   * Handles incoming results from the SearchBar component (TASK-014).
   *
   * Stores the results array in state so the sidebar renders the search
   * results list instead of the full note catalog. When the API returns zero
   * matches for an active query, results is [] and the "No notes found"
   * message is shown. Distinguishing "zero results" from "query cleared" is
   * the responsibility of handleSearchClear (called via SearchBar's onClear).
   *
   * @param {Array<{id: string, title: string, snippet: string}>} results
   */
  const handleSearchResults = useCallback((results) => {
    setSearchResults(results);
  }, []);

  /**
   * Handles query clear events from the SearchBar component (TASK-014).
   *
   * Called when the user clears the search input. Resets searchResults to
   * null so the normal note catalog is restored in the sidebar.
   */
  const handleSearchClear = useCallback(() => {
    setSearchResults(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Responsive handlers (TASK-018)
  // ---------------------------------------------------------------------------

  /**
   * Toggles the sidebar overlay open or closed on sub-desktop viewports.
   */
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  /**
   * Closes the sidebar overlay on sub-desktop viewports.
   * Called when the backdrop is clicked or Escape is pressed.
   */
  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  /**
   * Switches the visible panel on mobile (single-panel view).
   *
   * @param {'sidebar'|'editor'|'preview'} panel
   */
  const handlePanelChange = useCallback((panel) => {
    setActivePanel(panel);
  }, []);

  // ---------------------------------------------------------------------------
  // Global keyboard shortcuts (TASK-025, REQ-018)
  // Wired here — after all handler functions are defined — so every callback
  // reference is stable and the dependency array is correct.
  // Replaces the former standalone Cmd+S and Escape useEffect blocks.
  // ---------------------------------------------------------------------------

  /**
   * Cmd/Ctrl+S shortcut handler — saves the currently active note.
   * No-op when no note is open. handleSave reads editorTitle/editorBody from
   * the enclosing closure, so they are in the dependency array.
   */
  const handleShortcutSave = useCallback(() => {
    if (activeNoteId) {
      handleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId, editorTitle, editorBody]);

  /**
   * Cmd/Ctrl+K shortcut handler — focuses the search bar input field.
   *
   * Uses a DOM query against the known aria-label on the SearchBar input
   * rather than a forwarded ref, so this handler does not require a ref
   * prop on the SearchBar component (which would break existing test mocks
   * that do not use forwardRef).
   */
  const handleShortcutFocusSearch = useCallback(() => {
    const searchInput = document.querySelector('[aria-label="Search notes"]');
    if (searchInput) {
      searchInput.focus();
    }
  }, []);

  /**
   * ? shortcut handler — toggles the keyboard shortcut reference overlay.
   */
  const handleShortcutToggleRef = useCallback(() => {
    setShowShortcutRef((prev) => !prev);
  }, []);

  /**
   * Escape shortcut handler — closes the shortcut reference overlay if it is
   * open; otherwise closes the sidebar overlay on sub-desktop viewports.
   */
  const handleShortcutEscape = useCallback(() => {
    if (showShortcutRef) {
      setShowShortcutRef(false);
    } else if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [showShortcutRef, sidebarOpen]);

  /**
   * Cmd/Ctrl+B shortcut handler — delegates to the Editor's boldSelection()
   * imperative method. No-op when the editor ref has not mounted.
   */
  const handleShortcutBold = useCallback(() => {
    editorRef.current?.boldSelection();
  }, []);

  /**
   * Cmd/Ctrl+I shortcut handler — delegates to the Editor's italicSelection()
   * imperative method. No-op when the editor ref has not mounted.
   */
  const handleShortcutItalic = useCallback(() => {
    editorRef.current?.italicSelection();
  }, []);

  useKeyboardShortcuts({
    onSave: handleShortcutSave,
    onNewNote: handleCreateNote,
    onBold: handleShortcutBold,
    onItalic: handleShortcutItalic,
    onFocusSearch: handleShortcutFocusSearch,
    onToggleShortcutRef: handleShortcutToggleRef,
    onEscape: handleShortcutEscape,
  });

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
  // Folder handlers (TASK-017)
  // ---------------------------------------------------------------------------

  /**
   * Sets the active folder filter. Null means "All Notes" (no filter).
   *
   * @param {string|null} folderId
   */
  const handleFolderSelect = useCallback((folderId) => {
    setActiveFolderId(folderId);
  }, []);

  /**
   * Prepends the newly created folder to the folders list and hides the
   * FolderCreateForm.
   *
   * @param {{ id: string, name: string, created_at: string, updated_at: string }} folder
   */
  const handleFolderCreated = useCallback((folder) => {
    setFolders((prev) => [folder, ...prev]);
    setShowFolderCreateForm(false);
  }, []);

  /**
   * Updates the name of the renamed folder in local state.
   *
   * @param {string} folderId
   * @param {string} newName
   */
  const handleFolderRenamed = useCallback((folderId, newName) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
    );
  }, []);

  /**
   * Removes the deleted folder from local state. If the deleted folder was
   * the active filter, resets to "All Notes" so the sidebar is not stuck
   * showing zero notes.
   *
   * @param {string} folderId
   */
  const handleFolderDeleted = useCallback((folderId) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setActiveFolderId((prev) => (prev === folderId ? null : prev));
  }, []);

  /**
   * Assigns the active note to the given folder (or removes it from any folder
   * when folderId is null). Calls PUT /api/notes/:id with { folderId } and
   * updates the note's folder_id in local notes state.
   *
   * @param {string|null} folderId - Target folder UUID, or null to move to root
   */
  const handleNoteFolderChange = useCallback(
    async (folderId) => {
      if (!activeNoteId) {
        return;
      }
      try {
        await updateNote(activeNoteId, { folderId: folderId || null });
        setNotes((prev) =>
          prev.map((n) =>
            n.id === activeNoteId ? { ...n, folder_id: folderId || null } : n
          )
        );
        setActiveNote((prev) =>
          prev ? { ...prev, folder_id: folderId || null } : prev
        );
      } catch {
        // Error state surfaced in a future iteration.
      }
    },
    [activeNoteId]
  );

  // ---------------------------------------------------------------------------
  // Derived state: notes filtered by active folder
  // ---------------------------------------------------------------------------

  /**
   * Notes visible in the sidebar. When activeFolderId is set, only notes
   * with a matching folder_id are shown. When null, all notes are shown
   * (All Notes view). Filtering is client-side — the full list is in state.
   */
  const visibleNotes = useMemo(() => {
    if (activeFolderId === null) {
      return notes;
    }
    return notes.filter((n) => n.folder_id === activeFolderId);
  }, [notes, activeFolderId]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  /**
   * Renders the editor area: a title input, the CodeMirror editor, a Save
   * button, and a folder assignment dropdown. The title input is a plain text
   * input above the editor. Controls are visible only when a note is active.
   *
   * @returns {JSX.Element}
   */
  function renderEditorPanel() {
    const activeNoteFolderId =
      activeNote ? activeNote.folder_id || '' : '';

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
              <select
                data-testid="note-folder-select"
                value={activeNoteFolderId}
                onChange={(e) => handleNoteFolderChange(e.target.value || null)}
                className="text-xs font-mono bg-bg-secondary border border-border text-text-secondary px-1 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                aria-label="Assign to folder"
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
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
              <button
                data-testid="export-button"
                onClick={handleExport}
                className="px-3 py-1 text-xs font-mono text-text-primary bg-bg-secondary border border-border hover:bg-border transition-colors"
              >
                Export
              </button>
            </div>
          </>
        )}
        <div className="flex-1 overflow-hidden border-r border-border">
          <Editor
            ref={editorRef}
            value={editorBody}
            onChange={handleEditorChange}
          />
        </div>
      </div>
    );
  }

  /**
   * Renders the sidebar slot containing: search bar, folder tree, new folder
   * toggle, FolderCreateForm (when toggled), and either search results or the
   * note catalog filtered by the active folder.
   *
   * When searchResults is non-null, the note catalog is replaced by the search
   * results list. Each result shows the note title and a snippet with
   * highlighted terms (rendered via dangerouslySetInnerHTML because the content
   * comes from server-generated ts_headline output, not user-supplied HTML).
   * Clicking a result opens the note in the editor.
   *
   * When searchResults is null (query cleared or no query entered), the normal
   * Sidebar catalog is displayed, filtered by activeFolderId.
   *
   * @returns {JSX.Element}
   */
  function renderSidebar() {
    return (
      <div className="flex flex-col h-full">
        <div className="px-2 py-2 border-b border-border">
          <SearchBar
            data-testid="search-bar"
            onResults={handleSearchResults}
            onClear={handleSearchClear}
            placeholder="Search notes..."
          />
        </div>

        {/* Folder navigation */}
        <div className="flex-shrink-0 border-b border-border">
          <FolderTree
            folders={folders}
            activeFolderId={activeFolderId}
            onFolderSelect={handleFolderSelect}
            onFolderRenamed={handleFolderRenamed}
            onFolderDeleted={handleFolderDeleted}
          />
          <div className="px-2 py-1">
            <button
              data-testid="new-folder-button"
              type="button"
              onClick={() => setShowFolderCreateForm((prev) => !prev)}
              className="text-xs font-mono text-text-secondary hover:text-text-primary"
            >
              {showFolderCreateForm ? '- Cancel new folder' : '+ New folder'}
            </button>
          </div>
          {showFolderCreateForm && (
            <FolderCreateForm
              onCreated={handleFolderCreated}
              onCancel={() => setShowFolderCreateForm(false)}
            />
          )}
        </div>

        {searchResults !== null ? (
          <div className="flex-1 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p
                data-testid="search-no-results"
                className="px-3 py-4 text-xs font-mono text-text-secondary"
              >
                No notes found.
              </p>
            ) : (
              <ul data-testid="search-results-list">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      data-testid={`search-result-${result.id}`}
                      onClick={() => handleSelectNote(result.id)}
                      className="w-full text-left px-3 py-2 border-b border-border hover:bg-border transition-colors"
                    >
                      <p className="text-sm font-mono text-text-primary truncate">
                        {result.title || 'Untitled'}
                      </p>
                      {result.snippet && (
                        <p
                          className="text-xs font-mono text-text-secondary mt-1 line-clamp-2"
                          /* snippet is server-generated ts_headline output containing <mark> tags — not user HTML */
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Sidebar
            notes={visibleNotes}
            activeNoteId={activeNoteId}
            onSelectNote={handleSelectNote}
            onCreateNote={handleCreateNote}
            user={user}
            onLogout={handleLogout}
            onSettings={() => navigate('/settings')}
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Hamburger toggle — visible only on sub-desktop (lg:hidden applied inside component) */}
      <div className="absolute top-2 left-2 z-50">
        <HamburgerToggle
          isOpen={sidebarOpen}
          onToggle={handleSidebarToggle}
        />
      </div>

      {/* '?' help button — positioned in the top-right corner for discoverability (TASK-025) */}
      <div className="absolute top-2 right-2 z-50">
        <button
          data-testid="shortcut-ref-button"
          type="button"
          aria-label="Show keyboard shortcuts"
          onClick={() => setShowShortcutRef((prev) => !prev)}
          className="text-xs font-mono text-text-secondary hover:text-text-primary px-2 py-1 border border-border bg-bg-secondary transition-colors"
        >
          ?
        </button>
      </div>

      {/* Keyboard shortcut reference overlay — rendered as a fixed overlay outside the grid (TASK-025) */}
      <ShortcutReference
        isOpen={showShortcutRef}
        onClose={() => setShowShortcutRef(false)}
      />

      <WorkspaceLayout
        sidebar={renderSidebar()}
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
        sidebarOpen={sidebarOpen}
        onSidebarClose={handleSidebarClose}
        activePanel={activePanel}
        onPanelChange={handlePanelChange}
      />
    </div>
  );
}

export default WorkspacePage;
