/**
 * Tests for TagInput component.
 *
 * Verifies inline tag add/remove UI: existing tags display, Enter-to-add,
 * comma-to-add, remove via TagChip × button, and validation feedback.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from '../components/tags/TagInput.jsx';

// Mock the tags API so no real fetch calls occur
vi.mock('../api/tags.js', () => ({
  addTagToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
}));

import { addTagToNote, removeTagFromNote } from '../api/tags.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TagInput', () => {
  const noteId = 'note-1';
  const existingTags = [
    { id: 't1', name: 'research' },
    { id: 't2', name: 'draft' },
  ];

  it('renders the tag input container', () => {
    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );
    expect(screen.getByTestId('tag-input')).toBeTruthy();
  });

  it('renders existing tags as TagChip components with remove buttons', () => {
    render(
      <TagInput
        noteId={noteId}
        existingTags={existingTags}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );
    expect(screen.getByText('research')).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
    expect(screen.getAllByTestId('tag-chip')).toHaveLength(2);
  });

  it('has a text input with placeholder "Add tag…"', () => {
    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('Add tag…')).toBeTruthy();
  });

  it('calls addTagToNote and onTagAdded when Enter is pressed with a valid tag name', async () => {
    const newTag = { id: 't3', name: 'important' };
    addTagToNote.mockResolvedValue({ tag: newTag });
    const onTagAdded = vi.fn();
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={onTagAdded}
        onTagRemoved={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'important');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(addTagToNote).toHaveBeenCalledWith('note-1', { name: 'important' });
      expect(onTagAdded).toHaveBeenCalledWith(newTag);
    });
  });

  it('clears the input after a successful tag add', async () => {
    addTagToNote.mockResolvedValue({ tag: { id: 't3', name: 'important' } });
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'important');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('calls addTagToNote when a comma is typed', async () => {
    addTagToNote.mockResolvedValue({ tag: { id: 't3', name: 'important' } });
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'important,');

    await waitFor(() => {
      expect(addTagToNote).toHaveBeenCalledWith('note-1', { name: 'important' });
    });
  });

  it('calls removeTagFromNote and onTagRemoved when a tag chip × is clicked', async () => {
    removeTagFromNote.mockResolvedValue(null);
    const onTagRemoved = vi.fn();
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={existingTags}
        onTagAdded={vi.fn()}
        onTagRemoved={onTagRemoved}
      />
    );

    await user.click(screen.getByRole('button', { name: /remove research/i }));

    await waitFor(() => {
      expect(removeTagFromNote).toHaveBeenCalledWith('note-1', 't1');
      expect(onTagRemoved).toHaveBeenCalledWith('t1');
    });
  });

  it('shows a validation error when the tag name is empty on Enter', async () => {
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Add tag…');
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('tag-input-error')).toBeTruthy();
    expect(addTagToNote).not.toHaveBeenCalled();
  });

  it('shows a validation error when the tag name contains spaces', async () => {
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'hello world');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('tag-input-error')).toBeTruthy();
    expect(addTagToNote).not.toHaveBeenCalled();
  });

  it('shows a validation error when the tag name exceeds 50 characters', async () => {
    const user = userEvent.setup();

    render(
      <TagInput
        noteId={noteId}
        existingTags={[]}
        onTagAdded={vi.fn()}
        onTagRemoved={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'a'.repeat(51));
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('tag-input-error')).toBeTruthy();
    expect(addTagToNote).not.toHaveBeenCalled();
  });
});
