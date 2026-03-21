/**
 * Tests for TagChip component.
 *
 * Verifies rendering of a tag pill with optional remove button.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagChip from '../components/tags/TagChip.jsx';

describe('TagChip', () => {
  const tag = { id: 't1', name: 'research' };

  it('renders the tag name', () => {
    render(<TagChip tag={tag} />);
    expect(screen.getByTestId('tag-chip')).toBeTruthy();
    expect(screen.getByText('research')).toBeTruthy();
  });

  it('does not render a remove button when onRemove is not provided', () => {
    render(<TagChip tag={tag} />);
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('renders a remove button when onRemove is provided', () => {
    render(<TagChip tag={tag} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /remove research/i })).toBeTruthy();
  });

  it('calls onRemove with the tag id when the remove button is clicked', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<TagChip tag={tag} onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: /remove research/i }));

    expect(onRemove).toHaveBeenCalledWith('t1');
  });
});
