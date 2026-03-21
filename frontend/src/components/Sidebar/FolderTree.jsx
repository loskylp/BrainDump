/**
 * FolderTree component.
 *
 * Renders the folder navigation section inside the sidebar catalog. Displays
 * a flat list of user-owned folders (single-level only per ADR-003). Each
 * folder is a clickable item that filters the note catalog to show only notes
 * in that folder. A special "All Notes" item shows all notes (no folder filter).
 *
 * Folder operations available inline:
 *   - Rename folder (opens inline rename input)
 *   - Delete folder (with confirmation via window.confirm)
 *
 * When a folder is deleted, notes that were in it move to root level
 * (folder_id set to NULL server-side via ON DELETE SET NULL -- ADR-003).
 * The parent page is responsible for refreshing the note catalog after deletion.
 *
 * Props:
 *   @prop {Array<{ id: string, name: string }>} folders - List of folders to render.
 *     Passed down from WorkspacePage which fetches via getFolders().
 *   @prop {string|null} activeFolderId - UUID of the currently selected folder,
 *     or null when "All Notes" is selected.
 *   @prop {function} onFolderSelect - Called with (folderId: string|null) when the
 *     user clicks a folder or "All Notes".
 *   @prop {function} onFolderRenamed - Called with (folderId: string, newName: string)
 *     after a successful rename. Parent refreshes its folder list.
 *   @prop {function} onFolderDeleted - Called with (folderId: string) after a
 *     successful deletion. Parent refreshes its folder list and note catalog.
 */

import React, { useState } from 'react';
import { updateFolder, deleteFolder } from '../../api/folders.js';

/**
 * Renders a single folder row with inline rename and delete controls.
 *
 * @param {object} props
 * @param {{ id: string, name: string }} props.folder
 * @param {boolean} props.isActive
 * @param {function} props.onSelect - Called with folder.id
 * @param {function} props.onRenamed - Called with (folderId, newName) after rename
 * @param {function} props.onDeleted - Called with (folderId) after delete
 * @returns {JSX.Element}
 */
function FolderItem({ folder, isActive, onSelect, onRenamed, onDeleted }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(folder.name);
  const [renameError, setRenameError] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

  const activeClasses = isActive
    ? 'bg-bg-tertiary border-l-2 border-accent'
    : 'hover:bg-bg-tertiary border-l-2 border-transparent';

  /**
   * Submits the rename request. Calls updateFolder and notifies parent on
   * success, or sets an inline error on failure.
   *
   * @param {React.FormEvent} e
   */
  async function handleRenameSubmit(e) {
    e.preventDefault();

    if (!renameDraft.trim()) {
      setRenameError('Name required.');
      return;
    }

    setIsWorking(true);
    setRenameError(null);

    try {
      await updateFolder(folder.id, renameDraft.trim());
      onRenamed(folder.id, renameDraft.trim());
      setIsRenaming(false);
    } catch {
      setRenameError('Rename failed.');
    } finally {
      setIsWorking(false);
    }
  }

  /**
   * Dismisses the rename input without saving.
   */
  function handleRenameCancel() {
    setRenameDraft(folder.name);
    setRenameError(null);
    setIsRenaming(false);
  }

  /**
   * Confirms deletion with window.confirm, then calls deleteFolder and notifies
   * the parent on success.
   */
  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete folder "${folder.name}"? Notes inside will be moved to root level.`
    );
    if (!confirmed) {
      return;
    }

    setIsWorking(true);
    try {
      await deleteFolder(folder.id);
      onDeleted(folder.id);
    } catch {
      // Error is silently ignored in v1; folder remains in list
      setIsWorking(false);
    }
  }

  if (isRenaming) {
    return (
      <li className={`border-l-2 border-transparent`}>
        <form
          data-testid={`folder-rename-form-${folder.id}`}
          onSubmit={handleRenameSubmit}
          className="flex items-center gap-1 px-2 py-1"
        >
          <input
            data-testid={`folder-rename-input-${folder.id}`}
            type="text"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && handleRenameCancel()}
            disabled={isWorking}
            autoFocus
            className="flex-1 text-xs font-mono bg-bg-secondary border border-border px-1 py-0.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            data-testid={`folder-rename-submit-${folder.id}`}
            type="submit"
            disabled={isWorking}
            className="text-xs font-mono text-text-secondary hover:text-text-primary"
          >
            OK
          </button>
          <button
            data-testid={`folder-rename-cancel-${folder.id}`}
            type="button"
            onClick={handleRenameCancel}
            disabled={isWorking}
            className="text-xs font-mono text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </form>
        {renameError && (
          <p className="text-xs font-mono text-red-400 px-2">{renameError}</p>
        )}
      </li>
    );
  }

  return (
    <li className={activeClasses}>
      <div className="flex items-center">
        <button
          data-testid={`folder-item-${folder.id}`}
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex-1 text-left px-4 py-1.5 text-sm font-mono text-text-primary truncate"
        >
          {folder.name}
        </button>
        <button
          data-testid={`folder-rename-button-${folder.id}`}
          type="button"
          onClick={() => {
            setRenameDraft(folder.name);
            setIsRenaming(true);
          }}
          disabled={isWorking}
          className="px-1 py-1 text-xs font-mono text-text-secondary hover:text-text-primary"
          aria-label={`Rename ${folder.name}`}
        >
          ✎
        </button>
        <button
          data-testid={`folder-delete-button-${folder.id}`}
          type="button"
          onClick={handleDelete}
          disabled={isWorking}
          className="px-1 py-1 text-xs font-mono text-text-secondary hover:text-red-400"
          aria-label={`Delete ${folder.name}`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

/**
 * Folder navigation tree for the sidebar.
 *
 * Renders an "All Notes" item at the top, followed by each user folder.
 * Clicking any item updates the active folder filter in the parent page.
 *
 * @param {object} props
 * @param {Array<{ id: string, name: string }>} props.folders
 * @param {string|null} props.activeFolderId
 * @param {function} props.onFolderSelect
 * @param {function} props.onFolderRenamed
 * @param {function} props.onFolderDeleted
 * @returns {JSX.Element}
 */
export default function FolderTree({
  folders,
  activeFolderId,
  onFolderSelect,
  onFolderRenamed,
  onFolderDeleted,
}) {
  const allNotesActive = activeFolderId === null;
  const allNotesClasses = allNotesActive
    ? 'bg-bg-tertiary border-l-2 border-accent'
    : 'hover:bg-bg-tertiary border-l-2 border-transparent';

  return (
    <nav data-testid="folder-tree" aria-label="Folder navigation">
      <ul>
        <li className={allNotesClasses}>
          <button
            data-testid="folder-all-notes"
            type="button"
            onClick={() => onFolderSelect(null)}
            className="w-full text-left px-4 py-1.5 text-sm font-mono text-text-primary"
          >
            All Notes
          </button>
        </li>
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            isActive={activeFolderId === folder.id}
            onSelect={onFolderSelect}
            onRenamed={onFolderRenamed}
            onDeleted={onFolderDeleted}
          />
        ))}
      </ul>
    </nav>
  );
}
