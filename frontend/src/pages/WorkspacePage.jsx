/**
 * WorkspacePage component.
 *
 * The authenticated user's primary workspace. Composes the three-panel layout
 * (WorkspaceLayout) with the note catalog (Sidebar), Markdown editor (Editor),
 * and live preview (Preview). Owns the top-level note selection and content state.
 *
 * State managed by this page:
 *   - activeNoteId: UUID of the currently open note (null if none selected)
 *   - notes: array of all user notes (for the sidebar catalog)
 *   - content: { title, body } of the currently open note (for editor and preview)
 *
 * Hook wiring:
 *   - useAutoSave: wired to content and activeNoteId (TASK-012)
 *   - useVersionTimer: wired to content and activeNoteId (TASK-013)
 *   - useAuth: provides user context for display (TASK-004)
 *
 * Data flow:
 *   Sidebar.onSelectNote -> load note from API -> set content in Editor
 *   Editor.onChange -> update content state -> Preview re-renders
 *   content change -> useAutoSave debounce timer resets
 *   content change -> useVersionTimer idle timer resets
 */

// TASK-016: workspace shell with placeholder panels
// TASK-007/008/009/012/013 will replace placeholders with real components

import React from 'react';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';

/**
 * @returns {JSX.Element}
 *
 * @precondition User is authenticated (ProtectedRoute ensures this)
 * @postcondition WorkspaceLayout renders with all three panels
 */
function WorkspacePage() {
  return (
    <WorkspaceLayout
      sidebar={
        <div className="p-4 text-text-secondary font-sans text-sm">
          {/* TASK-008: Sidebar component replaces this placeholder */}
          <p className="text-text-muted">Notes will appear here</p>
        </div>
      }
      editor={
        <div className="p-4 text-text-muted font-mono text-sm">
          {/* TASK-007: Editor component replaces this placeholder */}
          <p>Select or create a note to start editing</p>
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
