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
 */

import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Renders a CodeMirror 6 Markdown editor with syntax highlighting.
 *
 * @param {object} props
 * @param {string} props.value - The current Markdown source (controlled)
 * @param {function} props.onChange - Callback invoked with the new string value on every edit
 * @param {boolean} [props.readOnly=false] - When true, editor is non-interactive
 * @returns {JSX.Element}
 *
 * @precondition props.value is a string
 * @postcondition CodeMirror renders with lang-markdown and Markdown syntax highlighting
 * @postcondition Every edit fires onChange with the full updated string value
 * @postcondition Preview update latency is < 100ms (via parent-controlled state, FF-D02)
 * @postcondition When readOnly is true, the editor does not accept user input
 */
function Editor({ value, onChange, readOnly = false }) {
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
        style={{
          height: '100%',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Source Code Pro', Consolas, monospace",
          fontSize: '14px',
        }}
      />
    </div>
  );
}

export default Editor;
