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

import { useState, useEffect, useRef, useCallback } from 'react';
import { updateNote } from '../api/notes.js';

/** Duration to show the "Saved" indicator before reverting to idle (ms). */
const SAVED_DISPLAY_MS = 1500;

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
export function useAutoSave({ noteId, content, debounceMs = 2000, onSave }) {
  const [status, setStatus] = useState('idle');

  // Refs to hold the latest values without re-creating the debounce timer
  const contentRef = useRef(content);
  const noteIdRef = useRef(noteId);
  const onSaveRef = useRef(onSave);
  const timerRef = useRef(null);
  const savedTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Track the last-saved content to avoid unnecessary saves
  const lastSavedRef = useRef(null);

  // Track whether this is the initial content load (skip auto-save on first render)
  const isInitialLoadRef = useRef(true);

  // Update refs on every render
  contentRef.current = content;
  noteIdRef.current = noteId;
  onSaveRef.current = onSave;

  // Reset initial load flag when noteId changes (new note selected)
  useEffect(() => {
    isInitialLoadRef.current = true;
    lastSavedRef.current = null;
    setStatus('idle');
  }, [noteId]);

  // Clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  /**
   * Performs the actual save. Reads from refs so it always sends the
   * latest content, even if React hasn't re-rendered yet.
   */
  const performSave = useCallback(async () => {
    const currentNoteId = noteIdRef.current;
    const currentContent = contentRef.current;

    if (!currentNoteId || !currentContent) {
      return;
    }

    // Skip if content hasn't changed since last save
    if (
      lastSavedRef.current &&
      lastSavedRef.current.title === currentContent.title &&
      lastSavedRef.current.body === currentContent.body
    ) {
      if (isMountedRef.current) setStatus('idle');
      return;
    }

    if (isMountedRef.current) setStatus('saving');

    try {
      await updateNote(currentNoteId, {
        title: currentContent.title,
        body: currentContent.body,
      });

      lastSavedRef.current = { ...currentContent };
      if (onSaveRef.current) onSaveRef.current(currentNoteId, currentContent.title);

      if (isMountedRef.current) {
        setStatus('saved');

        // Revert to idle after a brief display period
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) setStatus('idle');
        }, SAVED_DISPLAY_MS);
      }
    } catch {
      if (isMountedRef.current) setStatus('error');
    }
  }, []);

  // Main debounce effect: resets timer on every content change
  useEffect(() => {
    if (!noteId || !content) {
      return;
    }

    // Skip the initial content load (when note is first opened, content is
    // set from the fetched note -- that is not a user edit)
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastSavedRef.current = { title: content.title, body: content.body };
      return;
    }

    // Content changed -- set pending and start/reset debounce timer
    setStatus('pending');

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [noteId, content?.title, content?.body, debounceMs, performSave]);

  return { status };
}
