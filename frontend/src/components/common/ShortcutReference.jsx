/**
 * ShortcutReference component.
 *
 * A keyboard shortcut reference overlay shown when the user presses '?' while
 * focus is not inside a text input, or via the '?' help button in the workspace
 * header (TASK-025, REQ-018 AC 8). Displays all registered shortcuts including
 * Cmd/Ctrl+B (bold) and Cmd/Ctrl+I (italic) added in TASK-025 AC-4, AC-5.
 *
 * The overlay is informational only — no actions are triggered from within
 * this component. Dismissal is handled by:
 *   - Clicking the close (X) button
 *   - Pressing Escape (this component registers its own keydown listener so
 *     it works even if useKeyboardShortcuts has not yet called onEscape)
 *   - Clicking the semi-transparent backdrop
 *
 * Accessibility:
 *   - role="dialog"
 *   - aria-modal="true"
 *   - aria-label="Keyboard shortcuts"
 *   - Close button has accessible label "Close keyboard shortcuts"
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the overlay is visible.
 * @param {function} props.onClose - Callback invoked when the user closes the overlay.
 *
 * @precondition isOpen controls mounting; the dialog is not rendered into the
 *   DOM when isOpen is false, keeping the DOM clean.
 * @postcondition onClose is called without arguments whenever the user closes
 *   the overlay via button, Escape, or backdrop click.
 */

import { useEffect, useRef } from 'react';

/**
 * @typedef {object} ShortcutEntry
 * @property {string} keys - Human-readable key combination shown in the table.
 * @property {string} description - Plain-language description of the action.
 */

/** @type {ShortcutEntry[]} */
const SHORTCUT_ENTRIES = [
  { keys: 'Cmd/Ctrl + S', description: 'Save note' },
  { keys: 'Cmd/Ctrl + N', description: 'New note' },
  { keys: 'Cmd/Ctrl + B', description: 'Bold selected text' },
  { keys: 'Cmd/Ctrl + I', description: 'Italic selected text' },
  { keys: 'Cmd/Ctrl + K', description: 'Focus search' },
  { keys: '?',            description: 'Show/hide shortcuts' },
  { keys: 'Esc',          description: 'Close panel / close sidebar' },
];

/**
 * Keyboard shortcut reference overlay panel.
 *
 * Returns null when isOpen is false so the component leaves no DOM nodes
 * behind when the overlay is closed.
 *
 * @param {{ isOpen: boolean, onClose: function }} props
 * @returns {JSX.Element|null}
 */
export default function ShortcutReference({ isOpen, onClose }) {
  const closeBtnRef = useRef(null);

  // Focus the close button when the overlay opens so keyboard users can dismiss
  // it immediately without tabbing through the content.
  useEffect(() => {
    if (isOpen && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [isOpen]);

  // Register a local Escape listener so the dialog can close itself even
  // without the parent wiring up onEscape through useKeyboardShortcuts.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    /**
     * Closes the overlay when Escape is pressed while it is open.
     * @param {KeyboardEvent} e
     */
    function handleEscape(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    /* Semi-transparent backdrop — clicking it closes the overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={onClose}
    >
      {/* Dialog panel — stop click propagation so clicks inside don't close the overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="relative bg-bg-secondary border border-border text-text-primary font-mono w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Keyboard shortcuts</h2>
          <button
            ref={closeBtnRef}
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* Shortcut table */}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 text-text-secondary font-medium">Shortcut</th>
              <th className="text-left pb-2 text-text-secondary font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUT_ENTRIES.map(({ keys, description }) => (
              <tr key={keys} className="border-b border-border last:border-0">
                <td className="py-2 pr-4 text-text-primary whitespace-nowrap">
                  <kbd className="bg-bg-tertiary border border-border px-1 py-0.5 text-xs rounded-sm text-text-primary">
                    {keys}
                  </kbd>
                </td>
                <td className="py-2 text-text-secondary">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
