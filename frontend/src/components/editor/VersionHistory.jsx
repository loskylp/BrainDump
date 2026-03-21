/**
 * VersionHistory component.
 *
 * Displays the version history for a note (TASK-013, REQ-016).
 * Shows a list of all prior versions with timestamps. Allows the user to
 * view a specific version's content (read-only) and restore the note to
 * a prior version.
 *
 * The component is rendered as a panel/overlay in the workspace when the
 * user opens version history for the active note.
 */

import React, { useState, useEffect } from 'react';
import { getVersions, restoreVersion } from '../../api/versions.js';

/**
 * Formats an ISO 8601 timestamp into a readable date+time string.
 * @param {string} isoString
 * @returns {string}
 */
function formatDateTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * @param {object} props
 * @param {string} props.noteId - UUID of the active note
 * @param {function} props.onClose - Callback to close the version history panel
 * @param {function} props.onRestore - Callback after a version is restored (receives { title, body })
 * @returns {JSX.Element}
 */
function VersionHistory({ noteId, onClose, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Load versions on mount and when noteId changes
  useEffect(() => {
    let cancelled = false;

    async function loadVersions() {
      setLoading(true);
      try {
        const data = await getVersions(noteId);
        if (!cancelled) {
          setVersions(data.versions);
          setSelectedVersion(null);
        }
      } catch {
        if (!cancelled) {
          setVersions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVersions();
    return () => { cancelled = true; };
  }, [noteId]);

  /**
   * Restores the note to the selected version.
   */
  async function handleRestore() {
    if (!selectedVersion || restoring) return;

    const confirmed = window.confirm(
      `Restore to version ${selectedVersion.version_number}? The current content will be saved as a new version before restoring.`
    );

    if (!confirmed) return;

    setRestoring(true);
    try {
      const result = await restoreVersion(noteId, selectedVersion.id);
      if (onRestore) {
        onRestore({ title: result.note.title, body: result.note.body });
      }
      // Reload versions to show the new pre-restore version
      const data = await getVersions(noteId);
      setVersions(data.versions);
      setSelectedVersion(null);
    } catch {
      // Error handling deferred
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div
      data-testid="version-history-panel"
      className="flex flex-col h-full bg-bg-secondary border-l border-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-text-primary text-sm font-medium">Version History</h2>
        <button
          data-testid="version-history-close"
          onClick={onClose}
          className="text-text-secondary hover:text-text-primary text-xs"
        >
          Close
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-3 text-text-muted text-xs">Loading...</p>
        ) : versions.length === 0 ? (
          <p className="px-4 py-3 text-text-muted text-xs">No versions yet.</p>
        ) : (
          <ul data-testid="version-list" className="divide-y divide-border">
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  data-testid={`version-item-${v.version_number}`}
                  onClick={() => setSelectedVersion(v)}
                  className={`w-full text-left px-4 py-2 cursor-pointer transition-colors ${
                    selectedVersion?.id === v.id
                      ? 'bg-bg-tertiary border-l-2 border-accent'
                      : 'hover:bg-bg-tertiary border-l-2 border-transparent'
                  }`}
                >
                  <p className="text-text-primary text-sm">
                    Version {v.version_number}
                  </p>
                  <p className="text-text-secondary text-xs mt-0.5">
                    {formatDateTime(v.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Selected version preview */}
      {selectedVersion && (
        <div className="border-t border-border">
          <div className="px-4 py-2 bg-bg-tertiary">
            <p className="text-text-primary text-xs font-medium mb-1">
              Version {selectedVersion.version_number} preview
            </p>
            <div
              data-testid="version-preview-content"
              className="text-text-secondary text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap"
            >
              {selectedVersion.body || '(empty)'}
            </div>
          </div>
          <div className="px-4 py-2">
            <button
              data-testid="version-restore-button"
              onClick={handleRestore}
              disabled={restoring}
              className="w-full py-1.5 px-3 text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary rounded focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            >
              {restoring ? 'Restoring...' : 'Restore this version'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VersionHistory;
