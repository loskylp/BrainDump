/**
 * useVersionTimer hook.
 *
 * Implements the 30-second idle version-check mechanism (ADR-004, REQ-016).
 *
 * Timer interaction rules (ADR-004):
 *   - The idle timer resets on EVERY content change (every keystroke)
 *   - On timer fire: calls POST /api/notes/:noteId/check-version
 *   - The server performs the diff and conditionally creates a NoteVersion
 *   - This hook NEVER updates the notes row (that is useAutoSave's job)
 *   - By the time this timer fires (t=30s), useAutoSave has already persisted
 *     the latest content (fired at t=2s), so the server reads current state
 *
 * Multiple tabs: each tab runs an independent instance of this hook. The
 * server-side diff check prevents duplicate versions -- if content hasn't
 * changed since the last version, no new row is created regardless of how
 * many tabs fire the check (ADR-004).
 */

import { useEffect, useRef, useCallback } from 'react';
import { checkVersion } from '../api/versions.js';

/**
 * @param {object} params
 * @param {string | null} params.noteId - UUID of the note, or null if no note is open
 * @param {string} params.contentKey - A value that changes on every keystroke
 * @param {number} [params.idleMs=30000] - Idle duration in milliseconds (ADR-004: 30000ms)
 * @param {function} [params.onVersionCreated] - Optional callback when server creates a new version
 * @returns {void}
 */
export function useVersionTimer({ noteId, contentKey, idleMs = 30000, onVersionCreated }) {
  const timerRef = useRef(null);
  const noteIdRef = useRef(noteId);
  const isInitialLoadRef = useRef(true);

  noteIdRef.current = noteId;

  // Reset initial load flag when noteId changes
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [noteId]);

  const triggerCheck = useCallback(async () => {
    const currentNoteId = noteIdRef.current;
    if (!currentNoteId) return;

    try {
      const result = await checkVersion(currentNoteId);
      if (result.versionCreated && onVersionCreated) {
        onVersionCreated({ versionNumber: result.versionNumber });
      }
    } catch {
      // Version check failure is non-critical; next idle period will retry
    }
  }, [onVersionCreated]);

  useEffect(() => {
    if (!noteId) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Skip the initial content load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Reset the idle timer on every content change
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      triggerCheck();
    }, idleMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [noteId, contentKey, idleMs, triggerCheck]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
