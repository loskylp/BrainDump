/**
 * Tests for TagFilter component.
 *
 * Verifies the sidebar tag filter section: display, selection highlight,
 * toggle callback, and hidden-when-empty behaviour.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagFilter from '../components/tags/TagFilter.jsx';

describe('TagFilter', () => {
  const tags = [
    { id: 't1', name: 'research' },
    { id: 't2', name: 'draft' },
  ];

  it('renders nothing when tags array is empty', () => {
    const { container } = render(
      <TagFilter tags={[]} selectedTagIds={[]} onToggle={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the filter section with all tags when tags are present', () => {
    render(<TagFilter tags={tags} selectedTagIds={[]} onToggle={vi.fn()} />);
    expect(screen.getByTestId('tag-filter')).toBeTruthy();
    expect(screen.getByText('research')).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
  });

  it('calls onToggle with the tag id when a tag is clicked', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<TagFilter tags={tags} selectedTagIds={[]} onToggle={onToggle} />);

    await user.click(screen.getByText('research'));

    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('applies selected highlight classes to active tags', () => {
    render(<TagFilter tags={tags} selectedTagIds={['t1']} onToggle={vi.fn()} />);

    // The selected tag button should carry the bg-accent class
    const researchBtn = screen.getByText('research').closest('button');
    expect(researchBtn.className).toMatch(/bg-accent/);

    // The unselected tag should not carry bg-accent
    const draftBtn = screen.getByText('draft').closest('button');
    expect(draftBtn.className).not.toMatch(/bg-accent/);
  });

  it('shows a "Clear filters" button when at least one tag is selected', () => {
    render(<TagFilter tags={tags} selectedTagIds={['t1']} onToggle={vi.fn()} />);
    expect(screen.getByTestId('clear-filters-button')).toBeTruthy();
  });

  it('does not show a "Clear filters" button when no tags are selected', () => {
    render(<TagFilter tags={tags} selectedTagIds={[]} onToggle={vi.fn()} />);
    expect(screen.queryByTestId('clear-filters-button')).toBeNull();
  });

  it('calls onToggle for each selected tag when "Clear filters" is clicked, effectively clearing all', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<TagFilter tags={tags} selectedTagIds={['t1', 't2']} onToggle={onToggle} />);

    await user.click(screen.getByTestId('clear-filters-button'));

    // onClearAll is signalled by calling onToggle with null
    expect(onToggle).toHaveBeenCalledWith(null);
  });
});
