/**
 * Verifier Acceptance Tests — TASK-028: Tagging system frontend — UI integration
 *
 * Requirement: REQ-021 — Global tagging system
 * ADR(s): ADR-010, ADR-008
 *
 * Acceptance criteria covered:
 *
 *   AC-1  Tag badges appear on note entries in the catalog sidebar (small colored labels)
 *   AC-2  Tag filter section visible in the sidebar showing all user tags as clickable badges
 *   AC-3  Clicking a tag badge toggles filter state; active filters are visually distinguished
 *   AC-4  When tag filters are active, only notes matching ANY selected tag are displayed (OR logic)
 *   AC-5  "Clear filters" removes all active tag filters and restores the full note list
 *   AC-6  "Add tag" input allows typing a tag name + Enter to add it; inline creation
 *   AC-7  (Acknowledged NOT IMPLEMENTED by Builder — see Builder deviation notes)
 *   AC-8  A tag on a note can be removed by clicking × on the tag badge in the editor view
 *   AC-9  Tag validation: names > 50 chars, names with spaces show a clear error message
 *   AC-10 (Acknowledged OUT OF SCOPE for this task — see Builder deviation notes)
 *
 * Test layers applied:
 *   Acceptance tests — component integration through rendered public interface
 *   (React Testing Library + Vitest/jsdom)
 *
 * Traceability: each describe block references REQ-NNN and AC-N.
 *
 * Negative cases are tagged [NEGATIVE] in the test name.
 * Verifier-added cases (beyond Analyst GWT scenarios) are tagged [VERIFIER-ADDED].
 *
 * Mocking strategy:
 *   useAuth, api/notes.js, api/tags.js, api/folders.js, and @uiw/react-codemirror
 *   are mocked so tests operate purely against the rendered component interface
 *   without network or database dependencies.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn(({ value, onChange }) => (
    <textarea
      data-testid="codemirror-mock"
      defaultValue={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  )),
}));

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/notes.js', () => ({
  getNotes: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../api/tags.js', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  addTagToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
}));

vi.mock('../api/folders.js', () => ({
  getFolders: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';
import { getNotes, getNote } from '../api/notes.js';
import { getTags, addTagToNote, removeTagFromNote } from '../api/tags.js';
import { getFolders } from '../api/folders.js';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides = {}) {
  return {
    id: 'note-1',
    title: 'Test Note',
    updated_at: '2026-03-21T10:00:00.000Z',
    folder_id: null,
    tags: [],
    ...overrides,
  };
}

function makeTag(overrides = {}) {
  return {
    id: 'tag-1',
    name: 'research',
    created_at: '2026-03-21T00:00:00.000Z',
    ...overrides,
  };
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Common test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  useAuth.mockReturnValue({
    user: { id: 'user-1', username: 'alice', email: 'alice@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });

  getFolders.mockResolvedValue({ folders: [] });
  getTags.mockResolvedValue({ tags: [] });
  getNotes.mockResolvedValue({ notes: [] });
  getNote.mockResolvedValue({
    note: makeNote({ id: 'note-1', title: 'Test Note', body: 'Body content', folder_id: null }),
  });
});

// ---------------------------------------------------------------------------
// AC-1 [REQ-021]: Tag badges appear on note entries in the catalog sidebar
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-021]: Tag badges in catalog sidebar', () => {
  it('Given a note with tags, the tags appear as badges below the note title in the catalog', async () => {
    // Given: a note with two tags
    const tags = [
      makeTag({ id: 'tag-1', name: 'research' }),
      makeTag({ id: 'tag-2', name: 'draft' }),
    ];
    const note = makeNote({ id: 'note-1', title: 'Tagged Note', tags });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags });

    // When: the workspace is rendered
    renderWorkspace();

    // Then: both tag badges appear in the sidebar under the note title
    await waitFor(() => {
      expect(screen.getByText('Tagged Note')).toBeTruthy();
    });
    const chips = screen.getAllByTestId('tag-chip');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(chips.some((c) => c.textContent.includes('research'))).toBe(true);
    expect(chips.some((c) => c.textContent.includes('draft'))).toBe(true);
  });

  it('[NEGATIVE] Given a note with no tags, no tag chips appear on that note entry', async () => {
    // Given: a note with empty tags array
    const note = makeNote({ id: 'note-1', title: 'Untagged Note', tags: [] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [] });

    // When: the workspace is rendered
    renderWorkspace();

    // Then: no tag-chip elements appear in the catalog area
    await waitFor(() => {
      expect(screen.getByText('Untagged Note')).toBeTruthy();
    });
    expect(screen.queryAllByTestId('tag-chip')).toHaveLength(0);
  });

  it('[VERIFIER-ADDED] Tag badges in the catalog sidebar are read-only (no × remove button)', async () => {
    // Given: a note with a tag rendered in the catalog
    const tags = [makeTag({ id: 'tag-1', name: 'research' })];
    const note = makeNote({ id: 'note-1', title: 'Tagged Note', tags });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags });

    renderWorkspace();

    await waitFor(() => screen.getAllByTestId('tag-chip'));

    // The catalog-rendered chip should not have a remove button
    // (× is only rendered when onRemove prop is passed, which Sidebar does not pass)
    const removeButtons = screen.queryAllByRole('button', { name: /remove research/i });
    expect(removeButtons).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-2 [REQ-021]: Tag filter section visible in the sidebar
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-021]: Tag filter section in sidebar', () => {
  it('Given the user has tags, the tag filter section is rendered above the note list', async () => {
    // Given: user has at least one tag
    const tags = [makeTag({ id: 'tag-1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });

    // When: workspace is rendered
    renderWorkspace();

    // Then: the tag-filter section is visible
    await waitFor(() => {
      expect(screen.getByTestId('tag-filter')).toBeTruthy();
    });
    expect(screen.getByText('research')).toBeTruthy();
  });

  it('[NEGATIVE] Given the user has no tags, the tag filter section is not rendered', async () => {
    // Given: empty tag list
    getTags.mockResolvedValue({ tags: [] });
    getNotes.mockResolvedValue({ notes: [] });

    renderWorkspace();

    // Allow mount effect to settle
    await waitFor(() => {
      expect(getNotes).toHaveBeenCalled();
    });

    // Then: no tag-filter section
    expect(screen.queryByTestId('tag-filter')).toBeNull();
  });

  it('All user tags are shown as clickable badges in the filter section', async () => {
    // Given: user has three tags
    const tags = [
      makeTag({ id: 't1', name: 'research' }),
      makeTag({ id: 't2', name: 'draft' }),
      makeTag({ id: 't3', name: 'important' }),
    ];
    getTags.mockResolvedValue({ tags });

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getByTestId('tag-filter')).toBeTruthy();
    });
    // Each tag appears as a clickable button inside the filter section
    expect(screen.getByRole('button', { name: 'research' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'draft' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'important' })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-3 [REQ-021]: Clicking a tag badge toggles filter state; visual distinction
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-021]: Tag filter toggle and visual state', () => {
  it('Given a tag filter chip, when clicked, its aria-pressed becomes true (selected)', async () => {
    // Given: one tag in the filter section
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));

    const researchBtn = screen.getByRole('button', { name: 'research' });
    // Initially: not selected
    expect(researchBtn.getAttribute('aria-pressed')).toBe('false');

    // When: user clicks the tag
    await user.click(researchBtn);

    // Then: aria-pressed is true
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'research' }).getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('Selected tag badges carry the accent background class (visually highlighted)', async () => {
    // Given: one tag
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));
    await user.click(screen.getByRole('button', { name: 'research' }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'research' });
      expect(btn.className).toMatch(/bg-accent/);
    });
  });

  it('[NEGATIVE] An unselected tag badge does NOT carry the accent background class', async () => {
    // Given: two tags, only one will be selected
    const tags = [
      makeTag({ id: 't1', name: 'research' }),
      makeTag({ id: 't2', name: 'draft' }),
    ];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));

    // Select only 'research'
    await user.click(screen.getByRole('button', { name: 'research' }));

    // Then: draft is NOT highlighted
    await waitFor(() => {
      const draftBtn = screen.getByRole('button', { name: 'draft' });
      expect(draftBtn.className).not.toMatch(/bg-accent/);
    });
  });

  it('Clicking a selected tag again deselects it (toggles off)', async () => {
    // Given: a tag that is already selected
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));

    // Select it
    await user.click(screen.getByRole('button', { name: 'research' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'research' }).getAttribute('aria-pressed')).toBe('true');
    });

    // When: clicked again
    await user.click(screen.getByRole('button', { name: 'research' }));

    // Then: deselected
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'research' }).getAttribute('aria-pressed')).toBe('false');
    });
  });
});

// ---------------------------------------------------------------------------
// AC-4 [REQ-021]: Active tag filters trigger re-fetch with tag IDs (OR logic)
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-021]: Notes list re-fetched with active tag filter (OR logic)', () => {
  it('When a tag filter is activated, getNotes is re-called with the selected tag ID', async () => {
    // Given: one tag
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));

    // When: user clicks the tag filter
    await user.click(screen.getByRole('button', { name: 'research' }));

    // Then: getNotes is called with the tag ID
    await waitFor(() => {
      const calls = getNotes.mock.calls;
      const filteredCall = calls.find((c) => Array.isArray(c[0]) && c[0].includes('t1'));
      expect(filteredCall).toBeTruthy();
    });
  });

  it('[NEGATIVE] When no tag filter is active, the initial getNotes call passes no tag IDs', async () => {
    // Given: no tags
    getTags.mockResolvedValue({ tags: [] });
    getNotes.mockResolvedValue({ notes: [] });

    renderWorkspace();

    await waitFor(() => expect(getNotes).toHaveBeenCalled());

    // Then: the first call has no tag-ID argument (called as getNotes() with no args,
    // relying on the default parameter tagIds = [] in the function signature).
    // The mock captures undefined for an omitted positional argument.
    const firstCall = getNotes.mock.calls[0];
    // Either no argument at all, or an empty array — both represent "no filter"
    expect(firstCall[0] === undefined || (Array.isArray(firstCall[0]) && firstCall[0].length === 0)).toBe(true);
  });

  it('[VERIFIER-ADDED] When two tags are selected, getNotes is called with both IDs (OR logic)', async () => {
    // Given: two tags
    const tags = [
      makeTag({ id: 't1', name: 'research' }),
      makeTag({ id: 't2', name: 'draft' }),
    ];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));

    // When: both tags are selected
    await user.click(screen.getByRole('button', { name: 'research' }));
    await user.click(screen.getByRole('button', { name: 'draft' }));

    // Then: getNotes called with both IDs
    await waitFor(() => {
      const calls = getNotes.mock.calls;
      const bothTagsCall = calls.find(
        (c) => Array.isArray(c[0]) && c[0].includes('t1') && c[0].includes('t2')
      );
      expect(bothTagsCall).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-5 [REQ-021]: "Clear filters" removes all active tag filters
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-021]: Clear filters action', () => {
  it('Given active tag filters, the "Clear filters" button becomes visible', async () => {
    // Given: one tag; user selects it
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));
    await user.click(screen.getByRole('button', { name: 'research' }));

    // Then: clear filters button appears
    await waitFor(() => {
      expect(screen.getByTestId('clear-filters-button')).toBeTruthy();
    });
  });

  it('Clicking "Clear filters" deselects all active tags', async () => {
    // Given: two tags both selected
    const tags = [
      makeTag({ id: 't1', name: 'research' }),
      makeTag({ id: 't2', name: 'draft' }),
    ];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));
    await user.click(screen.getByRole('button', { name: 'research' }));
    await user.click(screen.getByRole('button', { name: 'draft' }));

    await waitFor(() => screen.getByTestId('clear-filters-button'));
    await user.click(screen.getByTestId('clear-filters-button'));

    // Then: both badges return to unselected state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'research' }).getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByRole('button', { name: 'draft' }).getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('[NEGATIVE] "Clear filters" button is NOT visible when no filters are active', async () => {
    // Given: tags present but none selected
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));

    // Then: clear filters button is absent
    expect(screen.queryByTestId('clear-filters-button')).toBeNull();
  });

  it('After clearing filters, getNotes is called with an empty tag array (full list restored)', async () => {
    // Given: one tag selected
    const tags = [makeTag({ id: 't1', name: 'research' })];
    getTags.mockResolvedValue({ tags });
    getNotes.mockResolvedValue({ notes: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByRole('button', { name: 'research' }));
    await user.click(screen.getByRole('button', { name: 'research' }));

    await waitFor(() => screen.getByTestId('clear-filters-button'));
    await user.click(screen.getByTestId('clear-filters-button'));

    // Then: getNotes eventually called with empty IDs after clear
    await waitFor(() => {
      const calls = getNotes.mock.calls;
      // Look for a call after the first that has empty tags (cleared state triggers re-fetch)
      const clearCall = calls.find((c) => Array.isArray(c[0]) && c[0].length === 0);
      expect(clearCall).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-6 [REQ-021]: "Add tag" input in editor — type + Enter to add (inline creation)
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-021]: Tag input in editor panel', () => {
  it('Given a note is open, the tag input container is visible below the toolbar', async () => {
    // Given: a note is open
    const note = makeNote({ id: 'note-1', title: 'My Note', tags: [] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByText('My Note'));
    await user.click(screen.getByText('My Note'));

    // Then: tag-input container is rendered
    await waitFor(() => {
      expect(screen.getByTestId('tag-input')).toBeTruthy();
    });
  });

  it('[NEGATIVE] When no note is open, the tag input is not rendered', async () => {
    // Given: no notes
    getNotes.mockResolvedValue({ notes: [] });
    getTags.mockResolvedValue({ tags: [] });

    renderWorkspace();

    await waitFor(() => screen.getByText(/no notes yet/i));

    // Then: tag-input is absent
    expect(screen.queryByTestId('tag-input')).toBeNull();
  });

  it('Typing a tag name and pressing Enter calls addTagToNote with the note id and name', async () => {
    // Given: a note is open
    const note = makeNote({ id: 'note-1', title: 'My Note', tags: [] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [] });
    addTagToNote.mockResolvedValue({ tag: makeTag({ id: 'tag-new', name: 'important' }) });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByText('My Note'));
    await user.click(screen.getByText('My Note'));
    await waitFor(() => screen.getByTestId('tag-input'));

    // When: user types a tag name and presses Enter
    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'important');
    await user.keyboard('{Enter}');

    // Then: addTagToNote called with the note id and the typed name
    await waitFor(() => {
      expect(addTagToNote).toHaveBeenCalledWith('note-1', { name: 'important' });
    });
  });

  it('After a successful tag add, the input field is cleared', async () => {
    // Given: a note is open
    const note = makeNote({ id: 'note-1', title: 'My Note', tags: [] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [] });
    addTagToNote.mockResolvedValue({ tag: makeTag({ id: 'tag-new', name: 'important' }) });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByText('My Note'));
    await user.click(screen.getByText('My Note'));
    await waitFor(() => screen.getByTestId('tag-input'));

    const input = screen.getByPlaceholderText('Add tag…');
    await user.type(input, 'important');
    await user.keyboard('{Enter}');

    // Then: input is cleared after successful add
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// AC-8 [REQ-021]: Remove tag from note via × button in editor view
// ---------------------------------------------------------------------------

describe('AC-8 [REQ-021]: Tag removal via × button in editor', () => {
  it('Given a note with a tag open in the editor, a × remove button is rendered for that tag', async () => {
    // Given: a note with a tag
    const tag = makeTag({ id: 'tag-1', name: 'research' });
    const note = makeNote({ id: 'note-1', title: 'Tagged Note', tags: [tag] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [tag] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByText('Tagged Note'));
    await user.click(screen.getByText('Tagged Note'));
    await waitFor(() => screen.getByTestId('tag-input'));

    // Then: an accessible remove button exists for the tag in the editor panel
    expect(screen.getByRole('button', { name: /remove research/i })).toBeTruthy();
  });

  it('Clicking × calls removeTagFromNote with the note id and tag id', async () => {
    // Given: a note with a tag open in the editor
    const tag = makeTag({ id: 'tag-1', name: 'research' });
    const note = makeNote({ id: 'note-1', title: 'Tagged Note', tags: [tag] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [tag] });
    removeTagFromNote.mockResolvedValue(null);
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByText('Tagged Note'));
    await user.click(screen.getByText('Tagged Note'));
    await waitFor(() => screen.getByTestId('tag-input'));

    // When: user clicks the × remove button
    await user.click(screen.getByRole('button', { name: /remove research/i }));

    // Then: removeTagFromNote called with correct ids
    await waitFor(() => {
      expect(removeTagFromNote).toHaveBeenCalledWith('note-1', 'tag-1');
    });
  });

  it('[NEGATIVE] When the note has no tags, no × remove button is rendered in the editor', async () => {
    // Given: a note with no tags
    const note = makeNote({ id: 'note-1', title: 'No Tags Note', tags: [] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [] });
    const user = userEvent.setup();

    renderWorkspace();

    await waitFor(() => screen.getByText('No Tags Note'));
    await user.click(screen.getByText('No Tags Note'));
    await waitFor(() => screen.getByTestId('tag-input'));

    // Then: no remove buttons
    expect(screen.queryAllByRole('button', { name: /remove/i })).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-9 [REQ-021]: Tag validation feedback in TagInput
// ---------------------------------------------------------------------------

describe('AC-9 [REQ-021]: Tag validation in editor input', () => {
  async function openNoteAndGetInput(user) {
    const note = makeNote({ id: 'note-1', title: 'My Note', tags: [] });
    getNotes.mockResolvedValue({ notes: [note] });
    getTags.mockResolvedValue({ tags: [] });

    renderWorkspace();

    await waitFor(() => screen.getByText('My Note'));
    await user.click(screen.getByText('My Note'));
    await waitFor(() => screen.getByTestId('tag-input'));

    return screen.getByPlaceholderText('Add tag…');
  }

  it('Given a tag name containing spaces, an error message is shown and the API is NOT called', async () => {
    const user = userEvent.setup();
    const input = await openNoteAndGetInput(user);

    // When: user types a name with a space and presses Enter
    await user.type(input, 'hello world');
    await user.keyboard('{Enter}');

    // Then: validation error is displayed; API not called
    expect(screen.getByTestId('tag-input-error')).toBeTruthy();
    expect(addTagToNote).not.toHaveBeenCalled();
  });

  it('Given a tag name exceeding 50 characters, an error message is shown and the API is NOT called', async () => {
    const user = userEvent.setup();
    const input = await openNoteAndGetInput(user);

    // When: user types a 51-character tag name
    await user.type(input, 'a'.repeat(51));
    await user.keyboard('{Enter}');

    // Then: validation error shown; API not called
    expect(screen.getByTestId('tag-input-error')).toBeTruthy();
    expect(addTagToNote).not.toHaveBeenCalled();
  });

  it('[NEGATIVE] A valid tag name (no spaces, <= 50 chars) does NOT show a validation error', async () => {
    const user = userEvent.setup();
    addTagToNote.mockResolvedValue({ tag: makeTag({ id: 'new', name: 'valid-tag' }) });

    const input = await openNoteAndGetInput(user);

    // When: user types a valid tag name
    await user.type(input, 'valid-tag');
    await user.keyboard('{Enter}');

    // Then: no validation error
    await waitFor(() => {
      expect(screen.queryByTestId('tag-input-error')).toBeNull();
    });
  });

  it('[VERIFIER-ADDED] An empty tag name (Enter pressed with no input) shows a validation error', async () => {
    const user = userEvent.setup();
    const input = await openNoteAndGetInput(user);

    // When: user presses Enter with no input
    await user.click(input);
    await user.keyboard('{Enter}');

    // Then: validation error shown
    expect(screen.getByTestId('tag-input-error')).toBeTruthy();
    expect(addTagToNote).not.toHaveBeenCalled();
  });

  it('[VERIFIER-ADDED] A tag name of exactly 50 characters is accepted without a validation error', async () => {
    const user = userEvent.setup();
    addTagToNote.mockResolvedValue({
      tag: makeTag({ id: 'new', name: 'a'.repeat(50) }),
    });

    const input = await openNoteAndGetInput(user);

    // When: user types exactly 50 characters
    await user.type(input, 'a'.repeat(50));
    await user.keyboard('{Enter}');

    // Then: no validation error; API was called
    await waitFor(() => {
      expect(addTagToNote).toHaveBeenCalledWith('note-1', { name: 'a'.repeat(50) });
    });
    expect(screen.queryByTestId('tag-input-error')).toBeNull();
  });
});
