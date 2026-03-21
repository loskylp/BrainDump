/**
 * FolderCreateForm component.
 *
 * Renders a compact inline form for creating a new folder. Intended to appear
 * inside the sidebar catalog section, immediately below the folder list or at
 * the end of it.
 *
 * The form is a single input (folder name) with a submit button. On success,
 * it notifies the parent and resets to an empty state. The parent (WorkspacePage
 * or FolderTree) is responsible for refreshing the folder list.
 *
 * Constraints:
 *   - Folder names must be non-empty (client-side validation before API call)
 *   - Single-level only: this form does not support specifying a parent folder
 *
 * Props:
 *   @prop {function} onCreated - Called with the created folder object
 *     { id: string, name: string, created_at: string, updated_at: string }
 *     after a successful API response. Parent uses this to prepend the folder
 *     to its local folder list without a full refetch.
 *   @prop {function} [onCancel] - Optional. Called when the user dismisses the
 *     form without creating a folder (e.g., presses Escape or a cancel button).
 */

import React, { useState } from 'react';
import { createFolder } from '../../api/folders.js';

/**
 * Inline form for creating a new named folder.
 *
 * Validates that the name is non-empty before calling the API. On success,
 * invokes onCreated with the server-returned folder object and resets the
 * input. On API failure, displays an inline error message. Pressing Escape
 * while the input is focused calls onCancel if provided.
 *
 * @param {object} props
 * @param {function} props.onCreated - Receives the created folder on success
 * @param {function} [props.onCancel] - Called on Escape key or Cancel button click
 * @returns {JSX.Element}
 */
export default function FolderCreateForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  /**
   * Validates the current name, calls createFolder, then notifies the parent
   * on success or sets an error message on failure.
   *
   * @param {React.FormEvent} e
   */
  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Folder name is required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await createFolder(name.trim());
      setName('');
      onCreated(data.folder);
    } catch {
      setErrorMessage('Failed to create folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Calls onCancel when Escape is pressed while the input is focused.
   *
   * @param {React.KeyboardEvent} e
   */
  function handleKeyDown(e) {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  }

  return (
    <form
      data-testid="folder-create-form"
      onSubmit={handleSubmit}
      className="px-2 py-1"
    >
      <div className="flex gap-1">
        <input
          data-testid="folder-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Folder name"
          disabled={isLoading}
          className="flex-1 text-sm font-mono bg-bg-secondary border border-border px-2 py-1 text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          data-testid="folder-create-submit"
          type="submit"
          disabled={isLoading}
          className="text-xs font-mono px-2 py-1 border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
        >
          {isLoading ? '...' : 'Create'}
        </button>
        {onCancel && (
          <button
            data-testid="folder-create-cancel"
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-xs font-mono px-2 py-1 border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      {errorMessage && (
        <p
          data-testid="folder-create-error"
          className="text-xs font-mono text-red-400 mt-1"
        >
          {errorMessage}
        </p>
      )}
    </form>
  );
}
