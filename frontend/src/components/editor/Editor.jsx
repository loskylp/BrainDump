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
 *   - Right border: 1px solid border (#DEE2E6) -- panel divider between editor and preview
 *   - Syntax highlighting via CodeMirror lang-markdown extension
 *   - No box shadows, no rounded corners on the editor container
 *
 * CodeMirror integration:
 *   Uses @uiw/react-codemirror as the React wrapper. The value and onChange
 *   are controlled via props -- WorkspacePage owns the canonical content state.
 *
 * Precondition: content is a string (may be empty).
 */

// TODO: TASK-007
import React from 'react';

/**
 * @param {object} props
 * @param {string} props.value - The current Markdown source (controlled)
 * @param {function} props.onChange - Callback invoked with the new string value on every edit
 * @param {boolean} [props.readOnly=false] - When true, editor is non-interactive (for version preview)
 * @returns {JSX.Element}
 *
 * @precondition props.value is a string
 * @postcondition CodeMirror renders with lang-markdown and Markdown syntax highlighting
 * @postcondition Every edit fires onChange with the full updated string
 * @postcondition Preview update latency is < 100ms (via parent-controlled state, FF-D02)
 */
function Editor({ value, onChange, readOnly = false }) {
  // TODO: TASK-007 -- implement using @uiw/react-codemirror with:
  //   extensions: [markdown()]
  //   theme appropriate for dark background
  //   controlled value/onChange wiring
  return null;
}

export default Editor;
