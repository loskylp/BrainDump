/**
 * AccountSettingsPage.
 *
 * Protected page at /settings. Contains user account management options.
 * Currently exposes account deletion via DeleteAccountSection (TASK-019).
 *
 * Auth required: yes -- ProtectedRoute wraps this page in App.jsx routing.
 *
 * On successful account deletion:
 *   - deleteAccount() invalidates all sessions server-side
 *   - This page navigates to /login, which clears local auth state via useAuth
 */

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DeleteAccountSection from '../components/auth/DeleteAccountSection.jsx';

/**
 * Renders the account settings page with a danger-zone deletion section.
 *
 * @returns {JSX.Element}
 *
 * @postcondition DeleteAccountSection is rendered with an onSuccess callback
 *   that redirects to /login after account deletion
 */
export default function AccountSettingsPage() {
  const navigate = useNavigate();

  /**
   * Navigates to /login after the account has been deleted server-side.
   * The session is already invalidated by the API, so any subsequent
   * /api/auth/me call will return 401, clearing the useAuth state.
   */
  function handleDeleteSuccess() {
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary font-mono">
      {/* Page header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-4">
        <Link
          to="/workspace"
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          &larr; Back to workspace
        </Link>
        <h1 className="text-lg font-semibold">Account Settings</h1>
      </div>

      {/* Settings content */}
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Danger zone */}
        <section className="border border-red-800 rounded p-6">
          <h2 className="text-base font-semibold text-red-400 mb-1">Danger Zone</h2>
          <p className="text-xs text-text-secondary mb-4">
            Actions in this section are irreversible.
          </p>
          <DeleteAccountSection onSuccess={handleDeleteSuccess} />
        </section>

      </div>
    </div>
  );
}
