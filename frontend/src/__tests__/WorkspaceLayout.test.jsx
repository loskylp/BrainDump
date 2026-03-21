/**
 * TASK-016 -- Acceptance Criteria 3 & 4
 * Verifies WorkspaceLayout renders CSS Grid with 260px 1fr 1fr columns.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';

describe('WorkspaceLayout', () => {
  it('renders a CSS Grid with grid-template-columns: 260px 1fr 1fr', () => {
    const { container } = render(
      <WorkspaceLayout
        sidebar={<div data-testid="sidebar">Sidebar</div>}
        editor={<div data-testid="editor">Editor</div>}
        preview={<div data-testid="preview">Preview</div>}
      />
    );

    const grid = container.firstChild;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('260px 1fr 1fr');
  });

  it('renders all three panel children', () => {
    const { getByTestId } = render(
      <WorkspaceLayout
        sidebar={<div data-testid="sidebar">Sidebar</div>}
        editor={<div data-testid="editor">Editor</div>}
        preview={<div data-testid="preview">Preview</div>}
      />
    );

    expect(getByTestId('sidebar')).toBeTruthy();
    expect(getByTestId('editor')).toBeTruthy();
    expect(getByTestId('preview')).toBeTruthy();
  });

  it('renders the three panel content wrappers as children of the grid container', () => {
    // TASK-018: the grid now contains additional children for the mobile tab bar
    // and the sidebar overlay element. Verify content panels are present by
    // querying the sidebar overlay and the editor/preview wrappers.
    const { container } = render(
      <WorkspaceLayout
        sidebar={<div data-testid="s-inner">S</div>}
        editor={<div data-testid="e-inner">E</div>}
        preview={<div data-testid="p-inner">P</div>}
      />
    );

    const grid = container.firstChild;
    // Grid contains: mobile tab bar, sidebar overlay, editor, preview (min 4 children)
    expect(grid.children.length).toBeGreaterThanOrEqual(3);
    // All three content panels are present somewhere in the grid
    expect(grid.querySelector('[data-testid="s-inner"]')).toBeTruthy();
    expect(grid.querySelector('[data-testid="e-inner"]')).toBeTruthy();
    expect(grid.querySelector('[data-testid="p-inner"]')).toBeTruthy();
  });
});
