/**
 * useKeyboardShortcuts hook.
 *
 * Registers global keyboard shortcuts for the workspace (TASK-025, REQ-018).
 * Shortcuts are attached as a single keydown listener on the document. The
 * hook cleans up the listener on unmount.
 *
 * Shortcuts defined (REQ-018 acceptance criteria):
 *   Ctrl/Cmd + S  — Trigger manual save of the current note (calls onSave).
 *                   Fires even when the event target is an INPUT or TEXTAREA.
 *   Ctrl/Cmd + N  — Create a new note (calls onNewNote).
 *                   Fires even when the event target is an INPUT or TEXTAREA.
 *   Ctrl/Cmd + K  — Focus the search input (calls onFocusSearch).
 *                   Suppressed when the event target is an INPUT, TEXTAREA, or
 *                   contenteditable element.
 *   ?             — Toggle the keyboard shortcut reference overlay
 *                   (calls onToggleShortcutRef). Suppressed when the event
 *                   target is an INPUT, TEXTAREA, or contenteditable element.
 *   Escape        — Close any open overlay (calls onEscape).
 *
 * Conflict avoidance (REQ-018 Fitness Functions):
 *   - Ctrl/Cmd+S is intercepted (event.preventDefault()) to suppress the
 *     browser's native "Save Page" dialog.
 *   - Ctrl/Cmd+N is intercepted (event.preventDefault()) to suppress the
 *     browser's "New Window" shortcut.
 *   - Ctrl/Cmd+K is intercepted (event.preventDefault()) to suppress the
 *     browser's address-bar-focus behaviour (VS Code, Notion, Slack pattern).
 *   - Ctrl/Cmd+W, Ctrl/Cmd+T, Ctrl/Cmd+L, Ctrl/Cmd+R, Ctrl/Cmd+Tab are
 *     never handled by this hook — browser defaults are preserved.
 *
 * @param {object} handlers - Callback map. All callbacks are optional; if
 *   omitted the shortcut is registered but does nothing.
 * @param {function} [handlers.onSave] - Called when Ctrl/Cmd+S is pressed.
 * @param {function} [handlers.onNewNote] - Called when Ctrl/Cmd+N is pressed.
 * @param {function} [handlers.onFocusSearch] - Called when Ctrl/Cmd+K is pressed
 *   and focus is not inside a text input.
 * @param {function} [handlers.onToggleShortcutRef] - Called when '?' is pressed
 *   and focus is not inside a text input.
 * @param {function} [handlers.onEscape] - Called when Escape is pressed.
 *
 * @returns {void} This hook registers side effects; it has no return value.
 *
 * @precondition Called once inside WorkspacePage (or an equivalent top-level
 *   component) so that global shortcuts are active for the full session.
 * @postcondition All event listeners are removed when the component unmounts.
 */

import { useEffect } from 'react';

/**
 * Returns true when the keyboard event originated inside an element that
 * accepts text input: INPUT, TEXTAREA, or any element with the
 * contenteditable attribute set to a truthy value.
 *
 * The contenteditable check uses getAttribute rather than the isContentEditable
 * DOM property because isContentEditable may be undefined in environments where
 * the element is not attached to a document (e.g., jsdom unit tests).
 *
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
function isTypingContext(e) {
  const target = e.target;
  if (!target) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    return true;
  }
  // isContentEditable is true when attached to DOM; fall back to getAttribute
  // for detached elements (e.g., in test environments).
  if (target.isContentEditable === true) {
    return true;
  }
  const ceAttr = typeof target.getAttribute === 'function'
    ? target.getAttribute('contenteditable')
    : null;
  if (ceAttr !== null && ceAttr !== 'false') {
    return true;
  }
  return false;
}

/**
 * @param {object} handlers
 * @param {function} [handlers.onSave]
 * @param {function} [handlers.onNewNote]
 * @param {function} [handlers.onFocusSearch]
 * @param {function} [handlers.onToggleShortcutRef]
 * @param {function} [handlers.onEscape]
 */
export function useKeyboardShortcuts({
  onSave,
  onNewNote,
  onFocusSearch,
  onToggleShortcutRef,
  onEscape,
} = {}) {
  useEffect(() => {
    /**
     * Dispatches keyboard events to the correct shortcut callback.
     *
     * The modifier key shortcuts (Cmd/Ctrl+S and Cmd/Ctrl+N) intentionally
     * bypass the typing-context guard so they work even inside the editor
     * text fields. All other shortcuts are suppressed when focus is inside a
     * text input or contenteditable element.
     *
     * @param {KeyboardEvent} e
     */
    function handleKeyDown(e) {
      const isMeta = e.metaKey || e.ctrlKey;
      const typing = isTypingContext(e);

      // Cmd/Ctrl+S — save note (fires even in text fields)
      if (isMeta && e.key === 's') {
        e.preventDefault();
        if (onSave) {
          onSave();
        }
        return;
      }

      // Cmd/Ctrl+N — new note (fires even in text fields)
      if (isMeta && e.key === 'n') {
        e.preventDefault();
        if (onNewNote) {
          onNewNote();
        }
        return;
      }

      // The remaining shortcuts are suppressed while the user is typing.
      if (typing) {
        return;
      }

      // Cmd/Ctrl+K — focus search input
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        if (onFocusSearch) {
          onFocusSearch();
        }
        return;
      }

      // ? — toggle the shortcut reference overlay (no modifier required)
      if (e.key === '?') {
        if (onToggleShortcutRef) {
          onToggleShortcutRef();
        }
        return;
      }

      // Escape — close any open overlay
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        }
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape]);
}
