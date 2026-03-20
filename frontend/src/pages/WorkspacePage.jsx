/**
 * WorkspacePage component.
 *
 * The authenticated user's primary workspace. Composes the three-panel layout
 * (WorkspaceLayout) with the note catalog (Sidebar), Markdown editor (Editor),
 * and live preview (Preview). Owns the top-level note selection and content state.
 *
 * Authentication: user is guaranteed authenticated by ProtectedRoute (TASK-004).
 * The logout button in the sidebar calls useAuth().logout() and navigates to /login.
 *
 * State managed by this page:
 *   - activeNoteId: UUID of the currently open note (null if none selected)
 *   - notes: array of all user notes (for the sidebar catalog)
 *   - content: { title, body } of the currently open note (for editor and preview)
 *
 * Hook wiring:
 *   - useAuth: provides user context and logout function (TASK-004)
 *   - useAutoSave: wired to content and activeNoteId (TASK-012)
 *   - useVersionTimer: wired to content and activeNoteId (TASK-013)
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
import { useNavigate } from 'react-router-dom';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';
import { useAuth } from '../hooks/useAuth.js';

/**
 * @returns {JSX.Element}
 *
 * @precondition User is authenticated (ProtectedRoute ensures this)
 * @postcondition WorkspaceLayout renders with all three panels
 * @postcondition Logout button is visible and functional in the sidebar panel
 */
function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <WorkspaceLayout
      sidebar={
        <div className="p-4 text-text-secondary font-sans text-sm flex flex-col h-full">
          {/* TASK-008: Sidebar component replaces this placeholder */}
          <p className="text-text-muted mb-4">Notes will appear here</p>

          <div className="mt-auto">
            {user && (
              <p className="text-text-muted text-xs mb-2 truncate" title={user.email}>
                {user.username}
              </p>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-1 px-3 text-sm border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary rounded focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Log out
            </button>
          </div>
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
