/**
 * DeleteAccountSection component.
 *
 * Renders the account deletion UI within the Account Settings page. Uses a
 * two-phase pattern to prevent accidental deletion:
 *
 *   idle       -> "Delete my account" button shown; no confirmation UI visible
 *   confirming -> Warning, password input, "Confirm delete" and "Cancel" buttons shown
 *   loading    -> Confirm button disabled while the API call is in-flight
 *   error      -> Inline error message shown below the password input
 *
 * On success:
 *   - The account is deleted server-side (all data CASCADE-deleted per ADR-003)
 *   - The current session is invalidated server-side
 *   - onSuccess() is called so the parent can redirect the user
 *
 * Props:
 *   @prop {function} onSuccess - Callback invoked after successful deletion.
 *     The parent (AccountSettingsPage) is responsible for redirecting the user.
 */

import React, { useState } from 'react';
import { deleteAccount } from '../../api/auth.js';
import { ApiError } from '../../api/client.js';

// ---------------------------------------------------------------------------
// Phase constants
// ---------------------------------------------------------------------------

const PHASE_IDLE = 'idle';
const PHASE_CONFIRMING = 'confirming';
const PHASE_LOADING = 'loading';
const PHASE_ERROR = 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Determines the user-facing error message for a failed deleteAccount call.
 *
 * Returns "Incorrect password" for 401 INVALID_CREDENTIALS responses.
 * Returns "Something went wrong. Please try again." for all other errors.
 *
 * @param {unknown} err - The caught error from deleteAccount()
 * @returns {string} User-facing error message
 */
function resolveErrorMessage(err) {
  if (err instanceof ApiError && err.error === 'INVALID_CREDENTIALS') {
    return 'Incorrect password';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Renders the "danger zone" account deletion section.
 *
 * @param {object} props
 * @param {function} props.onSuccess - Called after account is successfully deleted
 * @returns {JSX.Element}
 */
export default function DeleteAccountSection({ onSuccess }) {
  /** @type {['idle'|'confirming'|'loading'|'error', Function]} */
  const [phase, setPhase] = useState(PHASE_IDLE);

  /** @type {[string, Function]} Current value of the password confirmation input */
  const [password, setPassword] = useState('');

  /** @type {[string, Function]} Error message displayed when deletion fails */
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Advances from idle to confirming phase, showing the password confirmation UI.
   */
  function handleInitiateDelete() {
    setPassword('');
    setErrorMessage('');
    setPhase(PHASE_CONFIRMING);
  }

  /**
   * Returns to idle phase, discarding the entered password and any error.
   */
  function handleCancel() {
    setPassword('');
    setErrorMessage('');
    setPhase(PHASE_IDLE);
  }

  /**
   * Submits the deletion request to the API.
   *
   * On success: calls onSuccess() so the parent can redirect.
   * On 401 INVALID_CREDENTIALS: shows "Incorrect password".
   * On other errors: shows a generic failure message.
   *
   * @param {React.FormEvent} e
   */
  async function handleConfirm(e) {
    e.preventDefault();
    setPhase(PHASE_LOADING);
    setErrorMessage('');

    try {
      await deleteAccount(password);
      onSuccess();
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
      setPhase(PHASE_ERROR);
    }
  }

  // ---------------------------------------------------------------------------
  // Idle state
  // ---------------------------------------------------------------------------

  if (phase === PHASE_IDLE) {
    return (
      <div>
        <button
          type="button"
          onClick={handleInitiateDelete}
          className="px-4 py-2 text-sm font-mono text-red-400 border border-red-800 hover:bg-red-900 hover:text-red-200 transition-colors"
        >
          Delete my account
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Confirming / loading / error states
  // ---------------------------------------------------------------------------

  return (
    <form onSubmit={handleConfirm}>
      <p className="text-sm font-mono text-red-400 mb-3">
        This will permanently delete your account and all your notes. This cannot be undone.
      </p>

      <label className="block mb-2 text-xs font-mono text-text-secondary" htmlFor="delete-account-password">
        Enter your password to confirm:
      </label>
      <input
        id="delete-account-password"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={phase === PHASE_LOADING}
        className="block w-full mb-3 px-3 py-2 text-sm font-mono bg-bg-secondary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {phase === PHASE_ERROR && errorMessage && (
        <p className="text-xs font-mono text-red-400 mb-3">{errorMessage}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={phase === PHASE_LOADING}
          className="px-4 py-2 text-sm font-mono text-red-400 border border-red-800 hover:bg-red-900 hover:text-red-200 transition-colors disabled:opacity-50"
        >
          {phase === PHASE_LOADING ? 'Deleting...' : 'Confirm delete'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={phase === PHASE_LOADING}
          className="px-4 py-2 text-sm font-mono text-text-secondary border border-border hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
