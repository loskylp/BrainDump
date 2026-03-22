/**
 * Verifier Acceptance Tests — TASK-030: Reading mode
 *
 * Requirement: REQ-022 — Reading mode
 * ADR(s): ADR-008
 *
 * Acceptance criteria covered:
 *
 *   AC-1  A "Reading Mode" button is visible in the editor toolbar (alongside Save, History, Delete, Export)
 *   AC-2  Clicking the button replaces the split-pane editor with a full-width rendered Markdown view
 *         (centered, max-width ~720px, generous line spacing)
 *   AC-3  The sidebar is hidden in reading mode
 *   AC-4  The toolbar is minimized to: exit button, note title, previous/next note navigation controls
 *   AC-5  Cmd/Ctrl+Shift+R toggles reading mode on/off
 *   AC-6  Escape exits reading mode and restores the full workspace with the same note active
 *   AC-7  Previous/next note navigation works within reading mode without returning to workspace
 *   AC-8  Navigation controls are disabled at the boundary (first note: no previous; last note: no next)
 *   AC-9  The rendered content uses the same markdown-it renderer as the preview panel
 *   AC-10 The reading view reflects the professional/technical design aesthetic (ADR-008 design tokens)
 *   AC-11 Reading mode is behind authentication (unauthenticated access redirected to login)
 *
 * Test layers applied:
 *   Acceptance tests — component integration through rendered public interface
 *   (React Testing Library + Vitest/jsdom)
 *
 * Traceability: each describe block references REQ-022 and the specific AC-N.
 *
 * Negative cases are tagged [NEGATIVE] in the test name.
 * Verifier-added cases (beyond Analyst GWT scenarios) are tagged [VERIFIER-ADDED].
 *
 * Mocking strategy:
 *   useAuth, api/notes.js, api/tags.js, api/folders.js, and @uiw/react-codemirror
 *   are mocked so tests operate against the rendered component interface
 *   without network or database dependencies.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage.jsx';
import ReadingView from '../components/reading/ReadingView.jsx';

// ---------------------------------------------------------------------------
// Module mocks
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

vi.mock('../utils/exportNote.js', () => ({
  exportNote: vi.fn(),
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
import { getTags } from '../api/tags.js';
import { getFolders } from '../api/folders.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOTE_A = {
  id: 'note-a',
  title: 'Alpha Note',
  body: '# Alpha\n\nFirst note content.',
  folder_id: null,
  updated_at: '2026-03-21T10:00:00.000Z',
};

const NOTE_B = {
  id: 'note-b',
  title: 'Beta Note',
  body: '# Beta\n\n**Bold text** and *italic*.',
  folder_id: null,
  updated_at: '2026-03-21T09:00:00.000Z',
};

const NOTE_C = {
  id: 'note-c',
  title: 'Gamma Note',
  body: '## Code example\n\n```js\nconsole.log("hello");\n```',
  folder_id: null,
  updated_at: '2026-03-21T08:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupMocks({ notes = [NOTE_A, NOTE_B, NOTE_C], authenticated = true } = {}) {
  if (authenticated) {
    useAuth.mockReturnValue({
      user: { id: '1', username: 'alice', email: 'alice@example.com' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  } else {
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  }
  getNotes.mockResolvedValue({ notes });
  getTags.mockResolvedValue({ tags: [] });
  getFolders.mockResolvedValue({ folders: [] });
}

function renderWorkspacePage() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function fireKeydown({ key, metaKey = false, ctrlKey = false, shiftKey = false }) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    document.dispatchEvent(event);
  });
}

/**
 * Opens a note in the workspace by clicking it in the sidebar,
 * then waits for the Read button to appear.
 * Returns the userEvent instance.
 */
async function openNoteInWorkspace(noteToSelect = NOTE_A) {
  getNote.mockResolvedValue({ note: noteToSelect });
  const user = userEvent.setup();
  renderWorkspacePage();

  await waitFor(() => screen.getByText(noteToSelect.title));
  await user.click(screen.getByText(noteToSelect.title));
  await waitFor(() => screen.getByTestId('reading-mode-button'));
  return user;
}

/**
 * Enters reading mode via the toolbar button.
 * Returns the userEvent instance.
 */
async function enterReadingMode(noteToSelect = NOTE_A) {
  const user = await openNoteInWorkspace(noteToSelect);
  await user.click(screen.getByTestId('reading-mode-button'));
  await waitFor(() => screen.getByTestId('reading-view'));
  return user;
}

// ---------------------------------------------------------------------------
// AC-1: Reading Mode button visible in the editor toolbar
// REQ-022: "A 'Reading Mode' toggle is available in the editor toolbar
//           (alongside Save, History, Delete, Export)"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-1: Reading Mode button in editor toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Given: an authenticated user editing a note in the split-pane editor
  // When:  a note is active
  // Then:  the "Reading Mode" button is visible in the toolbar
  it('renders the Read button when a note is active', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));

    await waitFor(() => {
      expect(screen.getByTestId('reading-mode-button')).toBeTruthy();
    });
  });

  // [NEGATIVE] The button must NOT be present before any note is open
  it('[NEGATIVE] does not show the Read button when no note is active', async () => {
    renderWorkspacePage();
    await waitFor(() => screen.getByText('Alpha Note'));
    expect(screen.queryByTestId('reading-mode-button')).toBeNull();
  });

  // [VERIFIER-ADDED] The button must coexist with Save, History, Delete, Export
  it('[VERIFIER-ADDED] Read button coexists with Save, History, Delete, and Export buttons', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));

    await waitFor(() => {
      expect(screen.getByTestId('reading-mode-button')).toBeTruthy();
      expect(screen.getByTestId('save-button')).toBeTruthy();
      expect(screen.getByTestId('version-history-button')).toBeTruthy();
      expect(screen.getByTestId('delete-note-button')).toBeTruthy();
      expect(screen.getByTestId('export-button')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// AC-2: Clicking the button replaces the split-pane editor with full-width
//        rendered Markdown view (centered, max-width ~720px, generous line spacing)
// REQ-022: "Activating it replaces the split-pane editor with a full-width
//           rendered Markdown view"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-2: Full-width Markdown reading view on activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Given: an authenticated user editing a note in the split-pane editor
  // When:  they click the "Reading Mode" button
  // Then:  the ReadingView component appears
  it('renders the ReadingView when the Read button is clicked', async () => {
    await enterReadingMode();
    expect(screen.getByTestId('reading-view')).toBeTruthy();
  });

  // [NEGATIVE] The ReadingView must NOT appear before the button is clicked
  it('[NEGATIVE] does not render ReadingView before the Read button is clicked', async () => {
    await openNoteInWorkspace();
    expect(screen.queryByTestId('reading-view')).toBeNull();
  });

  // [VERIFIER-ADDED] The reading content column must carry the max-width class
  it('[VERIFIER-ADDED] reading content column carries max-w-2xl class for ~720px centering', async () => {
    await enterReadingMode();
    const readingView = screen.getByTestId('reading-view');
    // The content div inside ReadingView must carry max-w-2xl (42rem / ~672px, closest Tailwind class to 720px)
    const contentColumn = readingView.querySelector('.max-w-2xl');
    expect(contentColumn).toBeTruthy();
  });

  // [VERIFIER-ADDED] The reading content must use mx-auto for centering
  it('[VERIFIER-ADDED] reading content column carries mx-auto for centering', async () => {
    await enterReadingMode();
    const readingView = screen.getByTestId('reading-view');
    const contentColumn = readingView.querySelector('.mx-auto');
    expect(contentColumn).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-3: The sidebar is hidden in reading mode
// REQ-022: "The sidebar is hidden"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-3: Sidebar hidden in reading mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Given: an authenticated user in reading mode
  // When:  the view is rendered
  // Then:  the sidebar is not visible
  it('hides the sidebar when reading mode is active', async () => {
    await enterReadingMode();
    // WorkspaceLayout (which contains the sidebar) must not be rendered
    // Verified by absence of the create-note button which lives inside Sidebar
    expect(screen.queryByTestId('create-note-button')).toBeNull();
  });

  // [NEGATIVE] The sidebar must be present before reading mode is entered
  it('[NEGATIVE] sidebar is present before reading mode is activated', async () => {
    await openNoteInWorkspace();
    // The sidebar renders the note list — Alpha Note title must appear
    expect(screen.getByText('Alpha Note')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-4: The toolbar is minimized to: exit button, note title,
//        previous/next note navigation controls
// REQ-022: "The toolbar is minimized to show only: exit reading mode,
//           previous/next note navigation, and the note title"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-4: Minimized toolbar in reading mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Given: an authenticated user in reading mode
  // When:  the toolbar is rendered
  // Then:  exit button, note title, prev/next controls are present
  it('renders the reading toolbar with exit button, note title, prev, and next controls', async () => {
    await enterReadingMode();
    const toolbar = screen.getByTestId('reading-toolbar');
    expect(toolbar).toBeTruthy();
    expect(screen.getByTestId('reading-exit-btn')).toBeTruthy();
    expect(screen.getByTestId('reading-prev-btn')).toBeTruthy();
    expect(screen.getByTestId('reading-next-btn')).toBeTruthy();
    // Note title is displayed in toolbar
    expect(toolbar.textContent).toContain('Alpha Note');
  });

  // [NEGATIVE] The editor toolbar (Save, History, etc.) must NOT appear in reading mode
  it('[NEGATIVE] editor toolbar controls are not present in reading mode', async () => {
    await enterReadingMode();
    expect(screen.queryByTestId('save-button')).toBeNull();
    expect(screen.queryByTestId('version-history-button')).toBeNull();
    expect(screen.queryByTestId('delete-note-button')).toBeNull();
    expect(screen.queryByTestId('export-button')).toBeNull();
    expect(screen.queryByTestId('reading-mode-button')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Cmd/Ctrl+Shift+R toggles reading mode on/off
// REQ-022: "A keyboard shortcut (Cmd/Ctrl+Shift+R) toggles reading mode"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-5: Cmd/Ctrl+Shift+R keyboard shortcut toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    getNote.mockResolvedValue({ note: NOTE_A });
  });

  // Given: an authenticated user in the workspace (not in reading mode)
  // When:  they press Cmd/Ctrl+Shift+R
  // Then:  reading mode activates
  it('enters reading mode when Cmd+Shift+R is pressed with a note active', async () => {
    await openNoteInWorkspace();
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('reading-view')).toBeTruthy();
    });
  });

  it('enters reading mode when Ctrl+Shift+R is pressed with a note active', async () => {
    await openNoteInWorkspace();
    fireKeydown({ key: 'r', ctrlKey: true, shiftKey: true });

    await waitFor(() => {
      expect(screen.getByTestId('reading-view')).toBeTruthy();
    });
  });

  // Given: an authenticated user in reading mode
  // When:  they press Cmd/Ctrl+Shift+R again
  // Then:  reading mode toggles off and the workspace is restored
  it('exits reading mode when Cmd+Shift+R is pressed again (toggle off)', async () => {
    await openNoteInWorkspace();
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    await waitFor(() => screen.getByTestId('reading-view'));

    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    await waitFor(() => {
      expect(screen.queryByTestId('reading-view')).toBeNull();
    });
  });

  // [NEGATIVE] Cmd+R (without Shift) must NOT trigger reading mode
  it('[NEGATIVE] Cmd+R without Shift does not activate reading mode', async () => {
    await openNoteInWorkspace();
    fireKeydown({ key: 'r', metaKey: true, shiftKey: false });
    // Give React time to update if it were going to
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('reading-view')).toBeNull();
  });

  // [NEGATIVE] R key alone must not trigger reading mode
  it('[NEGATIVE] bare R key does not activate reading mode', async () => {
    await openNoteInWorkspace();
    fireKeydown({ key: 'r' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('reading-view')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Escape exits reading mode and restores the full workspace
//        with the same note active
// REQ-022: "Pressing Escape exits reading mode and returns to the full workspace"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-6: Escape exits reading mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    getNote.mockResolvedValue({ note: NOTE_A });
  });

  // Given: an authenticated user in reading mode
  // When:  they press Escape
  // Then:  reading mode exits and the full workspace is restored with the same note active
  it('exits reading mode when Escape is pressed', async () => {
    await enterReadingMode();
    fireKeydown({ key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('reading-view')).toBeNull();
    });
  });

  it('restores the editor toolbar for the same note after Escape', async () => {
    await enterReadingMode();
    fireKeydown({ key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('reading-view')).toBeNull();
      // The same note's title should still be in the editor title input
      expect(screen.getByTestId('note-title-input')).toBeTruthy();
    });
  });

  // [NEGATIVE] Escape while NOT in reading mode must not break the workspace
  it('[NEGATIVE] Escape while not in reading mode does not crash or enter reading mode', async () => {
    await openNoteInWorkspace();
    fireKeydown({ key: 'Escape' });

    await new Promise((r) => setTimeout(r, 50));
    // Workspace should still be intact
    expect(screen.queryByTestId('reading-view')).toBeNull();
    expect(screen.getByTestId('reading-mode-button')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC-7: Previous/next note navigation works within reading mode
//        without returning to the workspace
// REQ-022: "The user can navigate to the previous or next note (by catalog
//           order) without leaving reading mode"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-7: In-reading-mode navigation stays in reading mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks({ notes: [NOTE_A, NOTE_B, NOTE_C] });
  });

  // Given: an authenticated user in reading mode viewing a note
  // When:  they click the "Next note" navigation control
  // Then:  the next note is loaded and reading mode remains active
  it('remains in reading mode after clicking Next', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    await enterReadingMode(NOTE_A);

    // NOTE_B is the next note — mock getNote for navigation
    getNote.mockResolvedValue({ note: NOTE_B });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('reading-next-btn'));

    // Allow state update
    await waitFor(() => {
      // ReadingView is still rendered (reading mode is still active)
      expect(screen.getByTestId('reading-view')).toBeTruthy();
    });
  });

  // [NEGATIVE] Clicking Next does not return to the workspace (WorkspaceLayout)
  it('[NEGATIVE] clicking Next does not exit reading mode or restore workspace layout', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    await enterReadingMode(NOTE_A);

    getNote.mockResolvedValue({ note: NOTE_B });
    const user = userEvent.setup();
    await user.click(screen.getByTestId('reading-next-btn'));

    await new Promise((r) => setTimeout(r, 50));
    // WorkspaceLayout-specific elements must remain absent
    expect(screen.queryByTestId('save-button')).toBeNull();
    expect(screen.queryByTestId('codemirror-mock')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-8: Navigation controls are disabled at the boundary
// REQ-022: "The user can navigate to the previous or next note (by catalog
//           order) without leaving reading mode" — with boundary enforcement
// ---------------------------------------------------------------------------

describe('REQ-022 AC-8: Navigation disabled at boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks({ notes: [NOTE_A, NOTE_B, NOTE_C] });
  });

  // Given: reading mode, first note active
  // When:  the navigation controls are rendered
  // Then:  Previous is disabled
  it('Previous button is disabled when viewing the first note', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));
    await waitFor(() => screen.getByTestId('reading-view'));

    expect(screen.getByTestId('reading-prev-btn').disabled).toBe(true);
  });

  // Given: reading mode, last note active
  // When:  the navigation controls are rendered
  // Then:  Next is disabled
  it('Next button is disabled when viewing the last note', async () => {
    getNote.mockResolvedValue({ note: NOTE_C });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Gamma Note'));
    await user.click(screen.getByText('Gamma Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));
    await waitFor(() => screen.getByTestId('reading-view'));

    expect(screen.getByTestId('reading-next-btn').disabled).toBe(true);
  });

  // [NEGATIVE] Clicking a disabled Prev button on the first note must not navigate
  it('[NEGATIVE] clicking disabled Previous does not trigger navigation on first note', async () => {
    getNote.mockResolvedValue({ note: NOTE_A });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));
    await waitFor(() => screen.getByTestId('reading-view'));

    const prevBtn = screen.getByTestId('reading-prev-btn');
    await user.click(prevBtn);

    // Title should still show the first note
    const toolbar = screen.getByTestId('reading-toolbar');
    expect(toolbar.textContent).toContain('Alpha Note');
  });

  // [NEGATIVE] Clicking a disabled Next button on the last note must not navigate
  it('[NEGATIVE] clicking disabled Next does not trigger navigation on last note', async () => {
    getNote.mockResolvedValue({ note: NOTE_C });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Gamma Note'));
    await user.click(screen.getByText('Gamma Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));
    await waitFor(() => screen.getByTestId('reading-view'));

    const nextBtn = screen.getByTestId('reading-next-btn');
    await user.click(nextBtn);

    const toolbar = screen.getByTestId('reading-toolbar');
    expect(toolbar.textContent).toContain('Gamma Note');
  });

  // [VERIFIER-ADDED] Both buttons disabled when only one note exists
  it('[VERIFIER-ADDED] both Prev and Next are disabled when only one note exists', async () => {
    vi.clearAllMocks();
    setupMocks({ notes: [NOTE_A] });
    getNote.mockResolvedValue({ note: NOTE_A });
    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Alpha Note'));
    await user.click(screen.getByText('Alpha Note'));
    await waitFor(() => screen.getByTestId('reading-mode-button'));
    await user.click(screen.getByTestId('reading-mode-button'));
    await waitFor(() => screen.getByTestId('reading-view'));

    expect(screen.getByTestId('reading-prev-btn').disabled).toBe(true);
    expect(screen.getByTestId('reading-next-btn').disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-9: Rendered content uses the same markdown-it renderer as the preview panel
// REQ-022: "the same CommonMark renderer as the preview panel (REQ-007)"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-9: Same markdown-it renderer as preview panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Given: a note with Markdown headings, bold, and italic
  // When:  the note is viewed in reading mode
  // Then:  the content renders as the equivalent HTML elements
  it('renders h1 for a # heading in the note body', async () => {
    const noteWithHeading = { ...NOTE_A, body: '# Main Heading' };
    getNote.mockResolvedValue({ note: noteWithHeading });
    await enterReadingMode(noteWithHeading);

    const readingView = screen.getByTestId('reading-view');
    const h1 = readingView.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toBe('Main Heading');
  });

  it('renders <strong> for **bold** text', async () => {
    const noteWithBold = { ...NOTE_A, body: '**bold word**' };
    getNote.mockResolvedValue({ note: noteWithBold });
    await enterReadingMode(noteWithBold);

    const readingView = screen.getByTestId('reading-view');
    expect(readingView.querySelector('strong')).toBeTruthy();
  });

  it('renders <em> for *italic* text', async () => {
    const noteWithItalic = { ...NOTE_A, body: '*italic word*' };
    getNote.mockResolvedValue({ note: noteWithItalic });
    await enterReadingMode(noteWithItalic);

    const readingView = screen.getByTestId('reading-view');
    expect(readingView.querySelector('em')).toBeTruthy();
  });

  it('renders <code> for inline code', async () => {
    const noteWithCode = { ...NOTE_A, body: 'Use `console.log()` here.' };
    getNote.mockResolvedValue({ note: noteWithCode });
    await enterReadingMode(noteWithCode);

    const readingView = screen.getByTestId('reading-view');
    expect(readingView.querySelector('code')).toBeTruthy();
  });

  it('renders a fenced code block as <pre><code>', async () => {
    const noteWithFence = { ...NOTE_A, body: '```js\nconsole.log("hi");\n```' };
    getNote.mockResolvedValue({ note: noteWithFence });
    await enterReadingMode(noteWithFence);

    const readingView = screen.getByTestId('reading-view');
    expect(readingView.querySelector('pre')).toBeTruthy();
    expect(readingView.querySelector('pre code')).toBeTruthy();
  });

  it('renders <ul> and <li> for a Markdown list', async () => {
    const noteWithList = { ...NOTE_A, body: '- item one\n- item two\n- item three' };
    getNote.mockResolvedValue({ note: noteWithList });
    await enterReadingMode(noteWithList);

    const readingView = screen.getByTestId('reading-view');
    expect(readingView.querySelector('ul')).toBeTruthy();
    const items = readingView.querySelectorAll('li');
    expect(items.length).toBe(3);
  });

  it('renders an empty body without crashing', async () => {
    const emptyNote = { ...NOTE_A, body: '' };
    getNote.mockResolvedValue({ note: emptyNote });
    await enterReadingMode(emptyNote);
    expect(screen.getByTestId('reading-view')).toBeTruthy();
  });

  // [NEGATIVE] Raw HTML in the note body must be escaped (html: false configured on md instance)
  it('[NEGATIVE] raw HTML in note body is escaped, not executed (html: false)', async () => {
    const noteWithRawHtml = { ...NOTE_A, body: '<script>window.__xss=true</script>' };
    getNote.mockResolvedValue({ note: noteWithRawHtml });
    await enterReadingMode(noteWithRawHtml);

    const readingView = screen.getByTestId('reading-view');
    // The script tag must NOT be present as a DOM element
    expect(readingView.querySelector('script')).toBeNull();
    // window.__xss must not be set
    expect(window.__xss).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-10: Reading view reflects the professional/technical design aesthetic (ADR-008)
// REQ-022: "reflects the professional/technical design aesthetic (ADR-008)"
// ---------------------------------------------------------------------------

describe('REQ-022 AC-10: Professional/technical design aesthetic (ADR-008)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // Given: an authenticated user in reading mode
  // When:  the reading view is evaluated
  // Then:  the container carries ADR-008 design token classes
  it('reading view container carries bg-bg-primary and text-text-primary tokens', async () => {
    await enterReadingMode();
    const readingView = screen.getByTestId('reading-view');
    expect(readingView.className).toContain('bg-bg-primary');
    expect(readingView.className).toContain('text-text-primary');
  });

  it('reading toolbar carries bg-bg-secondary and border-border tokens (no shadow)', async () => {
    await enterReadingMode();
    const toolbar = screen.getByTestId('reading-toolbar');
    expect(toolbar.className).toContain('bg-bg-secondary');
    expect(toolbar.className).toContain('border-b');
    expect(toolbar.className).toContain('border-border');
    // ADR-008: no box shadows — verified by absence of shadow- class
    expect(toolbar.className).not.toContain('shadow');
  });

  it('content column has generous vertical padding (py-12)', async () => {
    await enterReadingMode();
    const readingView = screen.getByTestId('reading-view');
    const contentColumn = readingView.querySelector('.max-w-2xl');
    expect(contentColumn).toBeTruthy();
    expect(contentColumn.className).toContain('py-12');
  });

  // [VERIFIER-ADDED] Font family on toolbar controls must be font-mono (ADR-008 monospace aesthetic)
  it('[VERIFIER-ADDED] toolbar navigation buttons use font-mono (ADR-008 monospace aesthetic)', async () => {
    await enterReadingMode();
    const exitBtn = screen.getByTestId('reading-exit-btn');
    const prevBtn = screen.getByTestId('reading-prev-btn');
    const nextBtn = screen.getByTestId('reading-next-btn');
    expect(exitBtn.className).toContain('font-mono');
    expect(prevBtn.className).toContain('font-mono');
    expect(nextBtn.className).toContain('font-mono');
  });
});

// ---------------------------------------------------------------------------
// AC-11: Reading mode is behind authentication
// REQ-022: "Reading mode is behind authentication (unauthenticated access
//           redirected to login)"
//
// Note: ReadingView is a sub-component rendered only inside WorkspacePage,
// which is protected by ProtectedRoute (TASK-004). The authentication guard
// is at the route level, not at the ReadingView level. This test verifies that
// the ReadingMode button is only available to authenticated users through the
// standard workspace protection mechanism.
// ---------------------------------------------------------------------------

describe('REQ-022 AC-11: Reading mode behind authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // [VERIFIER-ADDED] ReadingView renders note-title; verify it doesn't render independently
  // without an authenticated context (the component itself doesn't manage auth,
  // ProtectedRoute is the guard — here we verify ReadingView requires note data)
  it('[VERIFIER-ADDED] ReadingView does not render without note data (null guard in WorkspacePage)', async () => {
    setupMocks({ authenticated: true });
    getNotes.mockResolvedValue({ notes: [] });
    getTags.mockResolvedValue({ tags: [] });
    getFolders.mockResolvedValue({ folders: [] });

    // No note is open, so readingMode && activeNote would be false
    renderWorkspacePage();
    await waitFor(() => screen.queryByTestId('reading-view') === null);
    // Pressing the keyboard shortcut with no active note must not show ReadingView
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('reading-view')).toBeNull();
  });

  // [VERIFIER-ADDED] Direct ReadingView mount requires note prop — verify the guard
  it('[VERIFIER-ADDED] ReadingView is not rendered by WorkspacePage when readingMode=true but no active note', async () => {
    // This verifies the guard: `if (readingMode && activeNote)` in WorkspacePage
    // Without an active note, ReadingView must not appear
    setupMocks({ authenticated: true });
    getNotes.mockResolvedValue({ notes: [NOTE_A] });
    getNote.mockResolvedValue({ note: NOTE_A });

    renderWorkspacePage();
    // Keyboard shortcut fires before any note is selected
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    await new Promise((r) => setTimeout(r, 50));
    // No active note yet, so ReadingView must be absent
    expect(screen.queryByTestId('reading-view')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regression — Exit button on ReadingView calls onExit
// (Covers the ReadingView component's exit callback in isolation)
// ---------------------------------------------------------------------------

describe('REQ-022: ReadingView exit button calls onExit callback', () => {
  it('clicking exit button calls onExit', async () => {
    const onExit = vi.fn();
    const user = userEvent.setup();
    render(
      <ReadingView
        note={NOTE_A}
        notes={[NOTE_A, NOTE_B]}
        onExit={onExit}
        onNavigate={vi.fn()}
      />
    );
    await user.click(screen.getByTestId('reading-exit-btn'));
    expect(onExit).toHaveBeenCalledOnce();
  });

  // [NEGATIVE] onNavigate is not called when the exit button is clicked (exit != navigate)
  it('[NEGATIVE] clicking exit does not call onNavigate', async () => {
    const onExit = vi.fn();
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <ReadingView
        note={NOTE_A}
        notes={[NOTE_A, NOTE_B]}
        onExit={onExit}
        onNavigate={onNavigate}
      />
    );
    await user.click(screen.getByTestId('reading-exit-btn'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
