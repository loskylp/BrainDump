/**
 * Sidebar component.
 *
 * The 260px-wide left panel containing the note catalog. Renders the list of
 * all user notes sorted by last modified date, with a "New note" action.
 * Clicking a note in the catalog loads it in the editor.
 *
 * Visual spec (ADR-008):
 *   - Background: bg-secondary (#F8F9FA)
 *   - Right border: 1px solid border (#DEE2E6) -- panel divider
 *   - Note titles: 14px, font-weight 500
 *   - Timestamps: 12px, text-secondary (#6C757D)
 *   - Empty state: guidance text when user has no notes
 *   - Width: 260px fixed (ADR-009)
 *
 * Scroll behavior: the note list is scrollable within the fixed-height sidebar.
 * The "New note" button remains pinned at the top.
 */

// TODO: TASK-008
import React from 'react';

/**
 * @param {object} props
 * @param {Array<{ id: string, title: string, updated_at: string }>} props.notes - List of user notes
 * @param {string | null} props.activeNoteId - UUID of the currently open note (for active state styling)
 * @param {function} props.onSelectNote - Callback invoked with noteId when a note is clicked
 * @param {function} props.onCreateNote - Callback invoked when "New note" is triggered
 * @param {boolean} props.isLoading - True while the note list is being fetched
 * @returns {JSX.Element}
 *
 * @postcondition Empty state is shown when notes.length === 0 and isLoading=false
 * @postcondition Active note entry is visually distinguished (background or border indicator)
 * @postcondition List renders without perceptible delay with 200 notes (virtual scroll not required)
 */
function Sidebar({ notes, activeNoteId, onSelectNote, onCreateNote, isLoading }) {
  // TODO: TASK-008 -- implement
  return null;
}

export default Sidebar;
