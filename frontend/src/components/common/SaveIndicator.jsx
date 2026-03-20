/**
 * SaveIndicator component.
 *
 * Displays the current auto-save status. Receives the status string from
 * useAutoSave and renders an appropriate visual indicator.
 *
 * Status -> display mapping:
 *   'idle'    -> nothing shown (or a faint "All changes saved" after a delay)
 *   'pending' -> nothing shown (debounce not yet fired)
 *   'saving'  -> "Saving..." with text-secondary color
 *   'saved'   -> "Saved" with success (#198754) color, fades after 2 seconds
 *   'error'   -> "Save failed" with error (#DC3545) color
 *
 * Visual spec (ADR-008):
 *   - 12px font (metadata size)
 *   - No icons -- text only
 *   - Positioned in the workspace toolbar or header bar (placement is a Builder decision)
 */

// TODO: TASK-012
import React from 'react';

/**
 * @param {object} props
 * @param {'idle' | 'pending' | 'saving' | 'saved' | 'error'} props.status - Current save status
 * @returns {JSX.Element | null}
 *
 * @postcondition 'saved' status disappears after approximately 2 seconds (via CSS transition or setTimeout)
 * @postcondition 'error' status persists until status changes (does not auto-hide)
 */
function SaveIndicator({ status }) {
  // TODO: TASK-012 -- implement
  return null;
}

export default SaveIndicator;
