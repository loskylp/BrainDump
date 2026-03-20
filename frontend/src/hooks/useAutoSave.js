/**
 * useAutoSave hook.
 *
 * Implements the 2-second debounce auto-save mechanism (ADR-004, REQ-015).
 *
 * Timer interaction rules (ADR-004):
 *   - The debounce timer resets on EVERY content change (every keystroke)
 *   - On timer fire: calls PUT /api/notes/:noteId with the current content
 *   - This hook NEVER creates a NoteVersion entry (that is useVersionTimer's job)
 *   - Auto-save owns the notes row; versioning owns the note_versions rows
 *
 * Status values:
 *   'idle'    -- No pending save, content matches last saved state
 *   'pending' -- Content has changed; debounce timer is running
 *   'saving'  -- PUT request is in flight
 *   'saved'   -- Last save was successful (shown briefly, then returns to 'idle')
 *   'error'   -- Last save failed (network error, 404, etc.)
 */

// TODO: TASK-012
import { useState, useEffect, useRef, useCallback } from 'react';
import { updateNote } from '../api/notes.js';

/**
 * @param {object} params
 * @param {string | null} params.noteId - UUID of the note to auto-save, or null if no note is open
 * @param {{ title: string, body: string }} params.content - Current editor content
 * @param {number} [params.debounceMs=2000] - Debounce delay in milliseconds (ADR-004: 2000ms)
 * @returns {{ status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }}
 *
 * @precondition noteId is a valid UUID when non-null
 * @postcondition On 'saving' -> 'saved': the notes row in the database has been updated
 * @postcondition On 'saving' -> 'error': no partial write occurred; prior save is intact
 * @postcondition The hook does NOT call any version-related API (ADR-004 separation)
 */
export function useAutoSave({ noteId, content, debounceMs = 2000 }) {
  // TODO: TASK-012 -- implement debounce timer, status state, PUT call
  throw new Error('Not implemented');
}
