/**
 * Editor component.
 *
 * CodeMirror 6 Markdown editor panel -- the left half of the split-pane
 * workspace (REQ-007). Renders the source Markdown with syntax highlighting
 * and fires onChange on every edit.
 *
 * Visual spec (ADR-008):
 *   - Background: bg-editor (#1E1E1E) -- dark code-editor feel
 *   - Font: JetBrains Mono (monospace stack) at 14px
 *   - No box shadows, no rounded corners on the editor container
 *   - Syntax highlighting via CodeMirror lang-markdown extension
 *
 * CodeMirror integration:
 *   Uses @uiw/react-codemirror as the React wrapper. The value and onChange
 *   are controlled via props -- WorkspacePage owns the canonical content state.
 *
 * Theme:
 *   oneDark theme matches the dark bg-editor background and provides
 *   professional syntax-highlighting colours consistent with ADR-008's
 *   "code-editor feel" directive.
 *
 * readOnly:
 *   When true, the editor enters non-interactive mode (used by VersionHistory
 *   to display a read-only diff view). Defaults to false.
 *
 * Imperative API (TASK-025 AC-4, AC-5):
 *   Exposed via forwardRef + useImperativeHandle so WorkspacePage can invoke
 *   formatting commands without owning the CodeMirror EditorView directly.
 *
 *   boldSelection()   — Wraps the current selection in ** markers. If the
 *                       selection is already wrapped in **, the markers are
 *                       removed (toggle). If there is no selection, inserts
 *                       **** and positions the cursor between the markers.
 *
 *   italicSelection() — Wraps the current selection in single * markers. If
 *                       the selection is already wrapped in a single * (not
 *                       **), the markers are removed (toggle). If there is no
 *                       selection, inserts ** and positions the cursor between
 *                       the markers.
 */

import React, { useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

// ---------------------------------------------------------------------------
// Internal helpers — text-wrapping logic for bold and italic toggles
// ---------------------------------------------------------------------------

/**
 * Determines whether the given text is wrapped with exactly the provided
 * prefix and suffix. Used to detect whether a selection is already bold
 * or italic so the toggle can unwrap instead of double-wrapping.
 *
 * @param {string} text - The selected text to inspect.
 * @param {string} prefix - The opening marker string (e.g. '**' or '*').
 * @param {string} suffix - The closing marker string (e.g. '**' or '*').
 * @returns {boolean}
 */
function isWrappedWith(text, prefix, suffix) {
  return text.startsWith(prefix) && text.endsWith(suffix) && text.length > prefix.length + suffix.length;
}

/**
 * Builds a CodeMirror transaction object that wraps or unwraps the current
 * selection with bold (**) markers.
 *
 * If no text is selected (from === to): inserts **** at the cursor and places
 * the cursor between the markers.
 *
 * If the selected text is already wrapped in **: unwraps by replacing the
 * whole selection with the inner text.
 *
 * Otherwise: wraps the selected text in ** on both sides.
 *
 * @param {import('@codemirror/state').EditorState} state - Current CM6 editor state.
 * @returns {object} A transaction spec suitable for view.dispatch().
 */
function buildBoldTransaction(state) {
  const { from, to } = state.selection.main;
  const selectedText = state.doc.sliceString(from, to);

  // No selection — insert markers and park cursor between them
  if (from === to) {
    return {
      changes: { from, to, insert: '****' },
      selection: { anchor: from + 2 },
    };
  }

  // Toggle: if already bold, unwrap
  if (isWrappedWith(selectedText, '**', '**')) {
    const inner = selectedText.slice(2, selectedText.length - 2);
    return { changes: { from, to, insert: inner } };
  }

  // Wrap with bold markers
  return { changes: { from, to, insert: `**${selectedText}**` } };
}

/**
 * Builds a CodeMirror transaction object that wraps or unwraps the current
 * selection with italic (*) markers.
 *
 * A selection wrapped in ** (bold) is NOT considered italic-wrapped — Cmd+I on
 * a bold selection wraps it further in * producing ***.
 *
 * If no text is selected (from === to): inserts ** at the cursor and places
 * the cursor between the markers.
 *
 * If the selected text is already wrapped in a single *: unwraps.
 *
 * Otherwise: wraps the selected text in * on both sides.
 *
 * @param {import('@codemirror/state').EditorState} state - Current CM6 editor state.
 * @returns {object} A transaction spec suitable for view.dispatch().
 */
function buildItalicTransaction(state) {
  const { from, to } = state.selection.main;
  const selectedText = state.doc.sliceString(from, to);

  // No selection — insert markers and park cursor between them
  if (from === to) {
    return {
      changes: { from, to, insert: '**' },
      selection: { anchor: from + 1 },
    };
  }

  // Toggle: if already italic with single * (and NOT bold **), unwrap
  if (
    isWrappedWith(selectedText, '*', '*') &&
    !isWrappedWith(selectedText, '**', '**')
  ) {
    const inner = selectedText.slice(1, selectedText.length - 1);
    return { changes: { from, to, insert: inner } };
  }

  // Wrap with italic markers
  return { changes: { from, to, insert: `*${selectedText}*` } };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a CodeMirror 6 Markdown editor with syntax highlighting.
 *
 * Accepts a forwarded ref. When a ref is provided, the component exposes two
 * imperative methods via useImperativeHandle:
 *   - boldSelection()   — toggle ** wrapping on the current selection
 *   - italicSelection() — toggle * wrapping on the current selection
 *
 * @param {object} props
 * @param {string} props.value - The current Markdown source (controlled)
 * @param {function} props.onChange - Callback invoked with the new string value on every edit
 * @param {boolean} [props.readOnly=false] - When true, editor is non-interactive
 * @param {React.Ref} ref - Forwarded ref for the imperative handle
 * @returns {JSX.Element}
 *
 * @precondition props.value is a string
 * @postcondition CodeMirror renders with lang-markdown and Markdown syntax highlighting
 * @postcondition Every edit fires onChange with the full updated string value
 * @postcondition Preview update latency is < 100ms (via parent-controlled state, FF-D02)
 * @postcondition When readOnly is true, the editor does not accept user input
 * @postcondition ref.current.boldSelection() wraps/unwraps the current CM6 selection in **
 * @postcondition ref.current.italicSelection() wraps/unwraps the current CM6 selection in *
 */
const Editor = forwardRef(function Editor({ value, onChange, readOnly = false }, ref) {
  /**
   * Holds the live CodeMirror EditorView instance. Populated via the
   * onCreateEditor callback once CM6 has mounted. Null until then.
   * @type {React.MutableRefObject<import('@codemirror/view').EditorView|null>}
   */
  const viewRef = useRef(null);

  /**
   * Stores the EditorView instance provided by @uiw/react-codemirror when the
   * CM6 editor mounts. This ref is used by the imperative handle methods to
   * dispatch formatting transactions.
   *
   * @param {import('@codemirror/view').EditorView} view - The live CM6 EditorView.
   */
  const handleCreateEditor = useCallback((view) => {
    viewRef.current = view;
  }, []);

  /**
   * Exposes boldSelection and italicSelection to the parent via forwardRef.
   * Both methods are no-ops when the EditorView has not yet mounted.
   */
  useImperativeHandle(ref, () => ({
    /**
     * Toggles bold (**) markers around the current CM6 selection.
     * If no text is selected, inserts **** and positions the cursor between
     * the markers. If the selection is already bold-wrapped, removes the
     * markers (toggle behaviour).
     *
     * @returns {void}
     */
    boldSelection() {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      view.dispatch(buildBoldTransaction(view.state));
    },

    /**
     * Toggles italic (*) markers around the current CM6 selection.
     * If no text is selected, inserts ** and positions the cursor between
     * the markers. If the selection is already italic-wrapped with a single *
     * (not **), removes the markers (toggle behaviour).
     *
     * @returns {void}
     */
    italicSelection() {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      view.dispatch(buildItalicTransaction(view.state));
    },
  }), []);

  return (
    <div
      data-testid="editor-panel"
      className="h-full bg-bg-editor overflow-y-auto"
    >
      <CodeMirror
        data-testid="codemirror-mock"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        theme={oneDark}
        extensions={[markdown()]}
        height="100%"
        onCreateEditor={handleCreateEditor}
        style={{
          height: '100%',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', Consolas, monospace",
          fontSize: '14px',
        }}
      />
    </div>
  );
});

export default Editor;
