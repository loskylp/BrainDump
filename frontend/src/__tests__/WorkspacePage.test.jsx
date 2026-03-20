/**
 * TASK-016 -- Verifies WorkspacePage renders WorkspaceLayout with three panels.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WorkspacePage from '../pages/WorkspacePage.jsx';

describe('WorkspacePage', () => {
  it('renders the workspace layout with three panel placeholders', () => {
    const { container } = render(<WorkspacePage />);

    // Should render the grid container
    const grid = container.firstChild;
    expect(grid).toBeTruthy();
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('260px 1fr 1fr');

    // Should have three panel divs
    expect(grid.children.length).toBe(3);
  });

  it('renders placeholder text in panels', () => {
    const { container } = render(<WorkspacePage />);

    expect(container.textContent).toContain('Notes will appear here');
    expect(container.textContent).toContain('Select or create a note to start editing');
    expect(container.textContent).toContain('Preview will appear here');
  });
});
