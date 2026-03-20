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

  it('renders three direct child panels in the grid container', () => {
    const { container } = render(
      <WorkspaceLayout
        sidebar={<div>S</div>}
        editor={<div>E</div>}
        preview={<div>P</div>}
      />
    );

    const grid = container.firstChild;
    // Three panel wrapper divs
    expect(grid.children.length).toBe(3);
  });
});
