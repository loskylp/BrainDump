/**
 * WorkspaceLayout component.
 *
 * Implements the three-panel CSS Grid workspace layout with responsive
 * breakpoint support (ADR-009, REQ-007, TASK-018).
 *
 * Desktop layout (>= 1024px):
 *   grid-template-columns: 260px 1fr 1fr (inline style — keeps existing test compatibility)
 *   Three panels visible simultaneously: Sidebar | Editor | Preview
 *   Sidebar overlay element uses lg:relative lg:translate-x-0 to participate in
 *   normal grid flow rather than being fixed-positioned.
 *
 * Tablet layout (768px-1023px):
 *   Sidebar uses fixed positioning (z-40), slides in from the left with a 0.2s
 *   CSS transition via transition-transform duration-200.
 *   When sidebarOpen is false: -translate-x-full (hidden off-screen left).
 *   When sidebarOpen is true: translate-x-0 (visible on-screen).
 *   A semi-transparent backdrop (z-30) renders behind the sidebar when open.
 *   Editor + preview remain visible in the two grid columns.
 *
 * Mobile layout (< 768px):
 *   Single panel visible at a time, controlled by activePanel prop.
 *   Tab bar at the top (md:hidden) with "Notes", "Edit", "Preview" buttons.
 *   Active panel's wrapper is shown; inactive panels use the hidden class.
 *
 * The sidebar is rendered exactly once in the DOM. On desktop the sidebar-overlay
 * element is in normal grid flow (lg:relative overrides fixed). On sub-desktop
 * it becomes a fixed overlay. This prevents duplicate DOM nodes.
 *
 * Panel boundaries use 1px solid border lines — no shadows or gradients (ADR-008).
 * The layout occupies the full viewport height (100vh) without overflow.
 *
 * @param {object} props
 * @param {React.ReactNode} props.sidebar - The Sidebar component instance
 * @param {React.ReactNode} props.editor - The Editor component instance
 * @param {React.ReactNode} props.preview - The Preview component instance
 * @param {boolean} [props.sidebarOpen=false] - Whether the sidebar overlay is visible on sub-desktop
 * @param {function} [props.onSidebarClose] - Called when the sidebar overlay should close
 * @param {string} [props.activePanel='editor'] - Which panel is visible on mobile: 'sidebar'|'editor'|'preview'
 * @param {function} [props.onPanelChange] - Callback for mobile tab bar panel switching
 *
 * @precondition All three panel children are provided
 * @postcondition At >= 1024px: all three panels are simultaneously visible in grid columns
 * @postcondition Panel widths at desktop: sidebar=260px, editor=1fr, preview=1fr
 * @postcondition At 768-1023px: sidebar overlay slides in from left when sidebarOpen is true
 * @postcondition At < 768px: only activePanel content is visible; tab bar switches panels
 */

import React from 'react';

function WorkspaceLayout({
  sidebar,
  editor,
  preview,
  sidebarOpen = false,
  onSidebarClose,
  activePanel = 'editor',
  onPanelChange,
}) {
  return (
    <div
      className="h-screen bg-bg-primary overflow-x-hidden relative"
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 1fr',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Mobile tab bar                                                        */}
      {/* Visible only below md (768px) via md:hidden.                         */}
      {/* col-span-3 spans all three grid columns.                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="mobile-tab-bar"
        className="md:hidden col-span-3 flex border-b border-border bg-bg-secondary"
      >
        <button
          type="button"
          className={`h-11 flex-1 text-sm font-sans ${
            activePanel === 'sidebar'
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-secondary'
          }`}
          onClick={() => onPanelChange && onPanelChange('sidebar')}
        >
          Notes
        </button>
        <button
          type="button"
          className={`h-11 flex-1 text-sm font-sans ${
            activePanel === 'editor'
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-secondary'
          }`}
          onClick={() => onPanelChange && onPanelChange('editor')}
        >
          Edit
        </button>
        <button
          type="button"
          className={`h-11 flex-1 text-sm font-sans ${
            activePanel === 'preview'
              ? 'border-b-2 border-accent text-accent'
              : 'text-text-secondary'
          }`}
          onClick={() => onPanelChange && onPanelChange('preview')}
        >
          Preview
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                               */}
      {/* Rendered once. On desktop (lg:): position returns to relative so the  */}
      {/* element participates in the grid as the first column. translate-x-0  */}
      {/* keeps it visible. On sub-desktop: fixed overlay, slides from the left.*/}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="sidebar-overlay"
        className={[
          'bg-bg-secondary border-r border-border overflow-y-auto h-full',
          // Tablet (md–lg): fixed overlay sliding in from the left
          'md:fixed md:top-0 md:left-0 md:h-full md:w-[260px] md:z-40',
          'md:transition-transform md:duration-200',
          sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full',
          // Desktop: cancel fixed, return to grid flow
          'lg:relative lg:translate-x-0 lg:z-auto lg:h-auto lg:w-auto',
          // Mobile: hidden when not active panel; md+ always block (transform controls tablet visibility)
          activePanel === 'sidebar' ? '' : 'hidden md:block',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {sidebar}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Editor panel                                                          */}
      {/* Hidden on mobile when not the active panel.                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={[
          'bg-bg-editor border-r border-border overflow-y-auto',
          activePanel !== 'editor' ? 'hidden md:block' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {editor}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Preview panel                                                         */}
      {/* Hidden on mobile when not the active panel.                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={[
          'bg-bg-primary overflow-y-auto',
          activePanel !== 'preview' ? 'hidden md:block' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {preview}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Backdrop                                                              */}
      {/* Semi-transparent overlay behind the sidebar overlay when open.       */}
      {/* Clicking it calls onSidebarClose to dismiss the sidebar.             */}
      {/* Only rendered when sidebarOpen is true.                              */}
      {/* ------------------------------------------------------------------ */}
      {sidebarOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="lg:hidden fixed inset-0 bg-black/30 z-30"
          onClick={onSidebarClose}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default WorkspaceLayout;
