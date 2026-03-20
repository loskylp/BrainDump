/**
 * Sidebar component.
 *
 * Renders the note catalog sidebar. Displays the user's list of notes sorted
 * by last modified date (newest first), a "New note" button, user info, and a
 * logout button.
 *
 * At desktop viewport (>= 1024px) the sidebar is always visible as the first
 * column in the CSS Grid workspace layout (260px fixed width, ADR-009).
 *
 * This component is purely presentational. It receives data and callbacks from
 * WorkspacePage and has no direct API or router dependencies.
 *
 * Design tokens applied (ADR-008):
 *   - bg-bg-secondary: sidebar background
 *   - text-text-secondary: metadata text (dates, username)
 *   - text-text-primary: note titles
 *   - text-text-muted: empty state and placeholders
 *   - accent: active note highlight and focus rings
 *   - border: panel divider and item separators
 *   - 12px / text-xs: metadata font size
 *   - 14px / text-sm: note title font size
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats an ISO 8601 timestamp into a short human-readable date string
 * (e.g. "Mar 20, 2026"). Uses the user's locale via Intl.DateTimeFormat.
 *
 * @param {string} isoString - ISO 8601 date string (e.g. "2026-03-20T10:00:00.000Z")
 * @returns {string} Short formatted date (month abbreviated, day, year)
 */
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Renders the empty state shown when the user has no notes.
 *
 * @returns {JSX.Element}
 */
function EmptyState() {
  return (
    <div
      data-testid="sidebar-empty-state"
      className="flex flex-col items-center justify-center flex-1 px-4 py-8 text-center"
    >
      <p className="text-text-muted text-sm mb-2">No notes yet</p>
      <p className="text-text-muted text-xs">
        Click "New note" above to create your first note.
      </p>
    </div>
  );
}

/**
 * Renders a single note entry in the catalog list.
 *
 * @param {object} props
 * @param {{ id: string, title: string, updated_at: string }} props.note - Note summary
 * @param {boolean} props.isActive - Whether this note is currently open in the editor
 * @param {function} props.onSelect - Callback invoked with the note id when clicked
 * @returns {JSX.Element}
 */
function NoteItem({ note, isActive, onSelect }) {
  const activeClasses = isActive
    ? 'bg-bg-tertiary border-l-2 border-accent'
    : 'hover:bg-bg-tertiary border-l-2 border-transparent';

  return (
    <li>
      <button
        type="button"
        data-testid={`note-item-${note.id}`}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onSelect(note.id)}
        className={`w-full text-left px-4 py-2 cursor-pointer transition-colors ${activeClasses}`}
      >
        <p className="text-text-primary text-sm font-medium truncate">
          {note.title || 'Untitled'}
        </p>
        <p className="text-text-secondary text-xs mt-0.5">
          {formatDate(note.updated_at)}
        </p>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Note catalog sidebar.
 *
 * @param {object} props
 * @param {Array<{ id: string, title: string, updated_at: string, folder_id: string|null }>} props.notes
 *   List of note summaries sorted by updated_at DESC (provided by WorkspacePage).
 * @param {string|null} props.activeNoteId - UUID of the currently open note, or null.
 * @param {function} props.onSelectNote - Called with the note UUID when a note is clicked.
 * @param {function} props.onCreateNote - Called with no arguments when the "New note" button is clicked.
 * @param {{ username: string, email: string }|null} props.user - Authenticated user info.
 * @param {function} props.onLogout - Called with no arguments when the logout button is clicked.
 * @returns {JSX.Element}
 *
 * @precondition notes is an array (may be empty)
 * @postcondition Renders a note list or empty state based on notes.length
 * @postcondition Active note is identified via aria-current="page" on its list item
 */
function Sidebar({ notes, activeNoteId, onSelectNote, onCreateNote, user, onLogout }) {
  return (
    <div className="flex flex-col h-full bg-bg-secondary">

      {/* Header: "New note" button */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <button
          type="button"
          onClick={onCreateNote}
          className="w-full py-1.5 px-3 text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary rounded focus:outline-none focus:ring-2 focus:ring-accent"
        >
          + New note
        </button>
      </div>

      {/* Note list or empty state */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <EmptyState />
        ) : (
          <ul
            data-testid="sidebar-note-list"
            className="divide-y divide-border"
          >
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onSelect={onSelectNote}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer: user info and logout */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        {user && (
          <p
            className="text-text-muted text-xs mb-2 truncate"
            title={user.email}
          >
            {user.username}
          </p>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-1 px-3 text-sm border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary rounded focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
