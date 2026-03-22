/**
 * Unit tests for ReadingView component (TASK-030, REQ-022).
 *
 * Tests verify:
 *   - The full-screen reading view renders with the correct data-testid attributes
 *   - The toolbar renders note title, previous, next, and exit buttons
 *   - The rendered Markdown content uses markdown-it (same as Preview)
 *   - Previous/Next navigation calls onNavigate with the correct adjacent note id
 *   - Previous button is disabled when the active note is first in the list
 *   - Next button is disabled when the active note is last in the list
 *   - Exit button calls onExit
 *   - onNavigate is not called when a disabled navigation button is clicked
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadingView from '../components/reading/ReadingView.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(id, title = 'Test Note', body = '# Hello') {
  return { id, title, body };
}

const NOTE_A = makeNote('note-a', 'Alpha', '# Alpha content');
const NOTE_B = makeNote('note-b', 'Beta', '# Beta content');
const NOTE_C = makeNote('note-c', 'Gamma', '# Gamma content');

const THREE_NOTES = [NOTE_A, NOTE_B, NOTE_C];

function renderReadingView({ note = NOTE_B, notes = THREE_NOTES, onExit = vi.fn(), onNavigate = vi.fn() } = {}) {
  return render(
    <ReadingView
      note={note}
      notes={notes}
      onExit={onExit}
      onNavigate={onNavigate}
    />
  );
}

// ---------------------------------------------------------------------------
// Structure and data-testid attributes
// ---------------------------------------------------------------------------

describe('ReadingView — structure', () => {
  it('renders the reading-view container', () => {
    renderReadingView();
    expect(screen.getByTestId('reading-view')).toBeTruthy();
  });

  it('renders the reading-toolbar', () => {
    renderReadingView();
    expect(screen.getByTestId('reading-toolbar')).toBeTruthy();
  });

  it('renders the previous button', () => {
    renderReadingView();
    expect(screen.getByTestId('reading-prev-btn')).toBeTruthy();
  });

  it('renders the next button', () => {
    renderReadingView();
    expect(screen.getByTestId('reading-next-btn')).toBeTruthy();
  });

  it('renders the exit button', () => {
    renderReadingView();
    expect(screen.getByTestId('reading-exit-btn')).toBeTruthy();
  });

  it('displays the note title in the toolbar', () => {
    renderReadingView({ note: NOTE_B });
    expect(screen.getByTestId('reading-toolbar').textContent).toContain('Beta');
  });
});

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

describe('ReadingView — Markdown rendering', () => {
  it('renders the note body as HTML via markdown-it', () => {
    renderReadingView({ note: makeNote('x', 'X', '# My Heading') });
    const view = screen.getByTestId('reading-view');
    // markdown-it converts "# My Heading" into <h1>My Heading</h1>
    expect(view.querySelector('h1')).toBeTruthy();
    expect(view.querySelector('h1').textContent).toBe('My Heading');
  });

  it('renders an empty body without crashing', () => {
    renderReadingView({ note: makeNote('x', 'X', '') });
    expect(screen.getByTestId('reading-view')).toBeTruthy();
  });

  it('renders a note with a null body without crashing', () => {
    renderReadingView({ note: { id: 'x', title: 'X', body: null } });
    expect(screen.getByTestId('reading-view')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Navigation — middle note (both prev and next enabled)
// ---------------------------------------------------------------------------

describe('ReadingView — navigation (middle note)', () => {
  it('previous button is enabled when there is a note before the current one', () => {
    renderReadingView({ note: NOTE_B, notes: THREE_NOTES });
    const prevBtn = screen.getByTestId('reading-prev-btn');
    expect(prevBtn.disabled).toBe(false);
  });

  it('next button is enabled when there is a note after the current one', () => {
    renderReadingView({ note: NOTE_B, notes: THREE_NOTES });
    const nextBtn = screen.getByTestId('reading-next-btn');
    expect(nextBtn.disabled).toBe(false);
  });

  it('clicking previous calls onNavigate with the preceding note id', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderReadingView({ note: NOTE_B, notes: THREE_NOTES, onNavigate });
    await user.click(screen.getByTestId('reading-prev-btn'));
    expect(onNavigate).toHaveBeenCalledWith('note-a');
  });

  it('clicking next calls onNavigate with the following note id', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderReadingView({ note: NOTE_B, notes: THREE_NOTES, onNavigate });
    await user.click(screen.getByTestId('reading-next-btn'));
    expect(onNavigate).toHaveBeenCalledWith('note-c');
  });
});

// ---------------------------------------------------------------------------
// Navigation — first note (previous disabled)
// ---------------------------------------------------------------------------

describe('ReadingView — navigation (first note)', () => {
  it('previous button is disabled when the note is first in the list', () => {
    renderReadingView({ note: NOTE_A, notes: THREE_NOTES });
    const prevBtn = screen.getByTestId('reading-prev-btn');
    expect(prevBtn.disabled).toBe(true);
  });

  it('next button is enabled when the note is first in the list', () => {
    renderReadingView({ note: NOTE_A, notes: THREE_NOTES });
    const nextBtn = screen.getByTestId('reading-next-btn');
    expect(nextBtn.disabled).toBe(false);
  });

  it('clicking the disabled previous button does not call onNavigate', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderReadingView({ note: NOTE_A, notes: THREE_NOTES, onNavigate });
    // The button is disabled, so the click should not fire
    await user.click(screen.getByTestId('reading-prev-btn'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Navigation — last note (next disabled)
// ---------------------------------------------------------------------------

describe('ReadingView — navigation (last note)', () => {
  it('next button is disabled when the note is last in the list', () => {
    renderReadingView({ note: NOTE_C, notes: THREE_NOTES });
    const nextBtn = screen.getByTestId('reading-next-btn');
    expect(nextBtn.disabled).toBe(true);
  });

  it('previous button is enabled when the note is last in the list', () => {
    renderReadingView({ note: NOTE_C, notes: THREE_NOTES });
    const prevBtn = screen.getByTestId('reading-prev-btn');
    expect(prevBtn.disabled).toBe(false);
  });

  it('clicking the disabled next button does not call onNavigate', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderReadingView({ note: NOTE_C, notes: THREE_NOTES, onNavigate });
    await user.click(screen.getByTestId('reading-next-btn'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Navigation — single note (both disabled)
// ---------------------------------------------------------------------------

describe('ReadingView — navigation (single note)', () => {
  it('both prev and next are disabled when there is only one note', () => {
    renderReadingView({ note: NOTE_A, notes: [NOTE_A] });
    expect(screen.getByTestId('reading-prev-btn').disabled).toBe(true);
    expect(screen.getByTestId('reading-next-btn').disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Exit
// ---------------------------------------------------------------------------

describe('ReadingView — exit', () => {
  it('clicking the exit button calls onExit', async () => {
    const onExit = vi.fn();
    const user = userEvent.setup();
    renderReadingView({ onExit });
    await user.click(screen.getByTestId('reading-exit-btn'));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
