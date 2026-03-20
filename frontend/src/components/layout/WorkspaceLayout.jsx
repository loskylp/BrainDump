/**
 * WorkspaceLayout component.
 *
 * Implements the three-panel CSS Grid workspace layout (ADR-009, REQ-007).
 *
 * Desktop layout (>= 1024px):
 *   grid-template-columns: 260px 1fr 1fr
 *   Three panels visible: Sidebar | Editor | Preview
 *
 * Responsive behavior:
 *   768px-1023px: Sidebar hidden behind toggle, Editor + Preview visible (TASK-018)
 *   < 768px:      Single panel with tab bar (TASK-018, Cycle 2)
 *
 * Panel boundaries use 1px solid border lines -- no shadows or gradients (ADR-008).
 * The layout occupies the full viewport height (100vh) without overflow.
 *
 * Children: this component renders the three panels as direct children:
 *   - sidebar (the sidebar panel passed as prop)
 *   - editor (the editor panel passed as prop)
 *   - preview (the preview panel)
 */

import React from 'react';

/**
 * @param {object} props
 * @param {React.ReactNode} props.sidebar - The Sidebar component instance
 * @param {React.ReactNode} props.editor - The Editor component instance
 * @param {React.ReactNode} props.preview - The Preview component instance
 * @returns {JSX.Element}
 *
 * @precondition All three panel children are provided
 * @postcondition At >= 1024px: all three panels are simultaneously visible
 * @postcondition Panel widths: sidebar=260px, editor=1fr, preview=1fr
 */
function WorkspaceLayout({ sidebar, editor, preview }) {
  return (
    <div
      className="h-screen bg-bg-primary"
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 1fr',
      }}
    >
      {/* Sidebar panel */}
      <div className="bg-bg-secondary border-r border-border overflow-y-auto">
        {sidebar}
      </div>

      {/* Editor panel */}
      <div className="bg-bg-editor border-r border-border overflow-y-auto">
        {editor}
      </div>

      {/* Preview panel */}
      <div className="bg-bg-primary overflow-y-auto">
        {preview}
      </div>
    </div>
  );
}

export default WorkspaceLayout;
