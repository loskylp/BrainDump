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

// TODO: TASK-013
import { useEffect, useRef, useCallback } from 'react';
import { checkVersion } from '../api/versions.js';

/**
 * @param {object} params
 * @param {string | null} params.noteId - UUID of the note, or null if no note is open
 * @param {string} params.contentKey - A value that changes on every keystroke (e.g., the content string itself or a counter). The hook resets the timer whenever this value changes.
 * @param {number} [params.idleMs=30000] - Idle duration in milliseconds (ADR-004: 30000ms)
 * @param {function} [params.onVersionCreated] - Optional callback invoked when the server creates a new version. Receives { versionNumber: number }.
 * @returns {void}
 *
 * @precondition noteId is a valid UUID when non-null
 * @postcondition On timer fire: POST /api/notes/:noteId/check-version is called
 * @postcondition This hook does NOT call PUT /api/notes/:noteId (ADR-004 separation)
 * @postcondition Timer is cleared when the component unmounts or noteId changes
 */
export function useVersionTimer({ noteId, contentKey, idleMs = 30000, onVersionCreated }) {
  // TODO: TASK-013 -- implement idle timer, reset on contentKey change,
  // call checkVersion, invoke onVersionCreated callback if version was created
  throw new Error('Not implemented');
}
