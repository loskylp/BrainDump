/**
 * Verifier Acceptance Tests — TASK-026: Export notes as Markdown
 *
 * REQ-019: Export notes as Markdown
 *
 * These tests verify the client-side export feature at the acceptance layer.
 * The export is entirely browser-side (Blob + URL.createObjectURL) — there is
 * no HTTP interface to drive. Tests operate on the public API of the
 * exportNote module, which is the authoritative unit of behaviour for this
 * requirement. WorkspacePage integration (button visibility, wiring) is
 * verified separately via the integration layer below.
 *
 * Acceptance criteria covered (REQ-019 GWT scenarios):
 *
 *   AC-1  Happy path — title "My Research Notes" → filename "my-research-notes.md",
 *         file contains exact raw Markdown body.
 *   AC-2  Filename sanitization — special chars removed, spaces → hyphens, lowercased.
 *   AC-3  Empty body — export succeeds; file is produced (does not throw or skip).
 *   AC-4  No backend call — export uses Blob/URL mechanism, no fetch/XHR.
 *   AC-5  Toolbar placement — Export button present alongside Save, History, Delete.
 *   AC-6  Long title truncation — filename stem capped at 100 characters.
 *   AC-7  [VERIFIER-ADDED] All-special-char title → "untitled.md" fallback.
 *   AC-8  [VERIFIER-ADDED] Whitespace-only title → "untitled.md" fallback.
 *   AC-9  [VERIFIER-ADDED] Blob type is text/markdown (not text/plain or text/html).
 *   AC-10 [VERIFIER-ADDED] URL.revokeObjectURL is called after download trigger
 *         (memory-leak guard).
 *   AC-11 [VERIFIER-ADDED] Export button absent when no note is active
 *         (ownership/visibility guard).
 *
 * Negative cases ensuring non-trivial pass:
 *   NC-1  sanitizeFilename returns "untitled" for empty input, NOT the empty string.
 *   NC-2  sanitizeFilename returns a slug, NOT the raw title with spaces or punctuation.
 *   NC-3  Blob type must be exactly "text/markdown", NOT "text/plain".
 *   NC-4  URL.revokeObjectURL must be called; a no-op implementation would leak memory.
 *
 * Run from the project root (requires Node + Vitest via frontend package):
 *   cd frontend && npx vitest run ../../tests/acceptance/TASK-026-export-note-verifier.test.js
 *
 * Or via npm test (Vitest picks up all *.test.js in the project tree when
 * the include glob matches):
 *   cd frontend && npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportNote, sanitizeFilename } from '../frontend/src/utils/exportNote.js';

// ---------------------------------------------------------------------------
// Mock browser download APIs (unavailable in jsdom)
// ---------------------------------------------------------------------------

let mockObjectUrl;
let createdBlob;
let createdAnchor;

beforeEach(() => {
  mockObjectUrl = 'blob:http://localhost/acceptance-test-uuid';

  URL.createObjectURL = vi.fn((blob) => {
    createdBlob = blob;
    return mockObjectUrl;
  });

  URL.revokeObjectURL = vi.fn();

  createdAnchor = null;
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = originalCreateElement(tag);
    if (tag === 'a') {
      createdAnchor = el;
      vi.spyOn(el, 'click').mockImplementation(() => {});
    }
    return el;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  createdBlob = undefined;
  createdAnchor = null;
});

// ---------------------------------------------------------------------------
// AC-1: Happy path — correct filename derived from title, body passed through
// REQ-019: "a file named 'my-research-notes.md' is downloaded containing the
//           exact raw Markdown source of the note body"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-1: Happy path export', () => {
  // Given: a note titled "My Research Notes" with Markdown body
  // When: exportNote is called
  // Then: download filename is "my-research-notes.md" and body is the raw Markdown

  it('derives filename "my-research-notes.md" from title "My Research Notes"', () => {
    exportNote('My Research Notes', '# Hello');
    expect(createdAnchor.download).toBe('my-research-notes.md');
  });

  it('passes the exact raw Markdown body to the Blob without modification', () => {
    const body = '# Heading\n\nSome **bold** text and a [link](https://example.com)';
    const originalBlob = globalThis.Blob;
    let capturedParts;
    globalThis.Blob = vi.fn(function (parts, options) {
      capturedParts = parts;
      return new originalBlob(parts, options);
    });

    exportNote('My Research Notes', body);

    expect(capturedParts).toEqual([body]);
    globalThis.Blob = originalBlob;
  });
});

// ---------------------------------------------------------------------------
// NC-2 (negative): raw title must NOT appear verbatim in the filename
// ---------------------------------------------------------------------------

describe('REQ-019 NC-2: Filename is sanitized, not the raw title', () => {
  it('does not use the raw title with spaces as the filename', () => {
    exportNote('My Research Notes', 'body');
    expect(createdAnchor.download).not.toBe('My Research Notes.md');
    expect(createdAnchor.download).not.toContain(' ');
  });
});

// ---------------------------------------------------------------------------
// AC-2: Filename sanitization
// REQ-019: "notes-week-3-draft.md" from "Notes: Week 3 (Draft!)"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-2: Filename sanitization', () => {
  // Given: note titled "Notes: Week 3 (Draft!)"
  // When: Export is clicked
  // Then: filename is "notes-week-3-draft.md"

  it('sanitizes "Notes: Week 3 (Draft!)" to "notes-week-3-draft.md"', () => {
    exportNote('Notes: Week 3 (Draft!)', 'some body');
    expect(createdAnchor.download).toBe('notes-week-3-draft.md');
  });

  it('lowercases the title', () => {
    expect(sanitizeFilename('UPPERCASE')).toBe('uppercase');
  });

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('hello world')).toBe('hello-world');
  });

  it('removes punctuation characters not in [a-z0-9-]', () => {
    expect(sanitizeFilename('My Note!')).toBe('my-note');
  });

  it('collapses multiple consecutive hyphens into one', () => {
    expect(sanitizeFilename('My  Note')).toBe('my-note');
  });

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeFilename('!Hello!')).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// NC-1 (negative): empty or degenerate title must NOT produce empty filename
// ---------------------------------------------------------------------------

describe('REQ-019 NC-1: Empty/degenerate title falls back to "untitled", not empty string', () => {
  it('returns "untitled" for empty string — not empty', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('')).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// AC-7 [VERIFIER-ADDED]: All-special-char title → "untitled.md"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-7 [VERIFIER-ADDED]: All-special-char title', () => {
  // Given: note titled "!!!" (all non-alphanumeric)
  // When: exportNote is called
  // Then: filename is "untitled.md"

  it('uses "untitled.md" for a title of all special characters', () => {
    exportNote('!!!', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });
});

// ---------------------------------------------------------------------------
// AC-8 [VERIFIER-ADDED]: Whitespace-only title → "untitled.md"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-8 [VERIFIER-ADDED]: Whitespace-only title', () => {
  // Given: note titled "   " (spaces only)
  // When: exportNote is called
  // Then: filename is "untitled.md"

  it('uses "untitled.md" for a whitespace-only title', () => {
    exportNote('   ', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });
});

// ---------------------------------------------------------------------------
// AC-3: Empty body — export must not fail or silently skip
// REQ-019: "a .md file is still downloaded (containing no body content)"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-3: Empty body export does not fail', () => {
  // Given: note with an empty body
  // When: Export is clicked
  // Then: no exception; a Blob is created and download is triggered

  it('does not throw when body is empty string', () => {
    expect(() => exportNote('My Note', '')).not.toThrow();
  });

  it('still creates a Blob even when body is empty', () => {
    exportNote('My Note', '');
    expect(createdBlob).toBeInstanceOf(Blob);
  });

  it('still triggers the download anchor click even when body is empty', () => {
    exportNote('My Note', '');
    expect(createdAnchor).not.toBeNull();
    expect(createdAnchor.download).toBe('my-note.md');
  });
});

// ---------------------------------------------------------------------------
// AC-4: No backend call
// REQ-019: "download completes without a network request to the backend"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-4: No backend network request made during export', () => {
  // Given: note with content already loaded in the editor
  // When: exportNote is called
  // Then: no fetch or XMLHttpRequest call is made

  it('does not call window.fetch during export', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({});
    exportNote('My Note', '# Content');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('uses URL.createObjectURL (Blob mechanism) not a network URL', () => {
    exportNote('My Note', '# Content');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    // The href must be the blob: URL returned by createObjectURL, not an http(s) URL
    expect(createdAnchor.href).toContain('blob:');
    expect(createdAnchor.href).not.toMatch(/^https?:\/\//);
  });
});

// ---------------------------------------------------------------------------
// AC-9 [VERIFIER-ADDED]: Blob MIME type must be text/markdown
// NC-3 (negative): must NOT be text/plain or text/html
// ---------------------------------------------------------------------------

describe('REQ-019 AC-9 [VERIFIER-ADDED]: Blob type is text/markdown', () => {
  // Given: any note export
  // When: Blob is created
  // Then: Blob.type === 'text/markdown', not 'text/plain' or 'text/html'

  it('creates the Blob with type "text/markdown"', () => {
    exportNote('My Note', 'body');
    expect(createdBlob.type).toBe('text/markdown');
  });

  it('does not use type "text/plain"', () => {
    exportNote('My Note', 'body');
    expect(createdBlob.type).not.toBe('text/plain');
  });

  it('does not use type "text/html"', () => {
    exportNote('My Note', 'body');
    expect(createdBlob.type).not.toBe('text/html');
  });
});

// ---------------------------------------------------------------------------
// AC-10 [VERIFIER-ADDED]: URL.revokeObjectURL called after download trigger
// NC-4 (negative): omitting revoke leaks memory — must be called
// ---------------------------------------------------------------------------

describe('REQ-019 AC-10 [VERIFIER-ADDED]: Object URL is revoked after download', () => {
  // Given: an export has been triggered
  // When: exportNote completes
  // Then: URL.revokeObjectURL is called with the object URL to free memory

  it('calls URL.revokeObjectURL with the object URL', () => {
    exportNote('My Note', 'body');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
  });

  it('calls URL.revokeObjectURL exactly once per export', () => {
    exportNote('My Note', 'body');
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Long title truncation
// REQ-019: "filename is truncated to a reasonable length (no longer than 100
//           characters before the .md extension)"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-6: Long title is truncated to ≤100 chars before ".md"', () => {
  // Given: note with a 200-character title
  // When: Export is clicked
  // Then: filename stem is at most 100 characters

  it('produces a filename stem of exactly 100 chars for a 120-char alpha title', () => {
    const longTitle = 'a'.repeat(120);
    exportNote(longTitle, 'body');
    const stem = createdAnchor.download.replace(/\.md$/, '');
    expect(stem.length).toBeLessThanOrEqual(100);
    expect(stem).toBe('a'.repeat(100));
  });

  it('appends ".md" even for a truncated title', () => {
    const longTitle = 'b'.repeat(200);
    exportNote(longTitle, 'body');
    expect(createdAnchor.download.endsWith('.md')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: WorkspacePage Export button presence and wiring
// REQ-019 AC-5 and AC-11 [VERIFIER-ADDED]
// ---------------------------------------------------------------------------

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../frontend/src/hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../frontend/src/api/notes.js', () => ({
  getNotes: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../frontend/src/utils/exportNote.js', () => ({
  exportNote: vi.fn(),
  sanitizeFilename: vi.fn((t) => t),
}));

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn(({ value, onChange }) => (
    <textarea
      data-testid="codemirror-mock"
      defaultValue={value}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  )),
}));

import { useAuth } from '../frontend/src/hooks/useAuth.js';
import { getNotes, getNote } from '../frontend/src/api/notes.js';
import { exportNote as mockExportNote } from '../frontend/src/utils/exportNote.js';
import WorkspacePage from '../frontend/src/pages/WorkspacePage.jsx';

function renderWorkspacePage() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('REQ-019 AC-5 / AC-11: Export button in editor toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { id: '1', username: 'alice', email: 'alice@example.com' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    getNotes.mockResolvedValue({ notes: [] });
  });

  // Given: no note is active (no note selected in sidebar)
  // When: the workspace is rendered
  // Then: no Export button is visible

  it('[AC-11] does not render export-button when no note is active', async () => {
    // Given: no note is active
    getNotes.mockResolvedValue({ notes: [] });

    renderWorkspacePage();

    // When: workspace settles
    await waitFor(() => {
      // Then: export button is absent
      expect(screen.queryByTestId('export-button')).toBeNull();
    });
  });

  // Given: an authenticated user with an active note
  // When: they look at the editor toolbar
  // Then: the Export button is visible alongside Save, History, and Delete

  it('[AC-5] renders export-button alongside Save, History, Delete when a note is active', async () => {
    const note = {
      id: 'note-26',
      title: 'Export Test Note',
      body: '# Hello\n\nworld',
      folder_id: null,
      updated_at: '2026-03-21T10:00:00.000Z',
    };
    getNotes.mockResolvedValue({
      notes: [{ id: note.id, title: note.title, updated_at: note.updated_at, folder_id: null }],
    });
    getNote.mockResolvedValue({ note });

    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Export Test Note'));
    await user.click(screen.getByText('Export Test Note'));

    await waitFor(() => {
      expect(screen.getByTestId('export-button')).toBeTruthy();
      expect(screen.getByTestId('save-button')).toBeTruthy();
      expect(screen.getByTestId('version-history-button')).toBeTruthy();
      expect(screen.getByTestId('delete-note-button')).toBeTruthy();
    });
  });

  // Given: an authenticated user with an active note
  // When: they click the Export button
  // Then: exportNote is called with the current title and body

  it('[AC-5] clicking export-button calls exportNote with current title and body', async () => {
    const note = {
      id: 'note-26',
      title: 'Export Test Note',
      body: '# Hello\n\nworld',
      folder_id: null,
      updated_at: '2026-03-21T10:00:00.000Z',
    };
    getNotes.mockResolvedValue({
      notes: [{ id: note.id, title: note.title, updated_at: note.updated_at, folder_id: null }],
    });
    getNote.mockResolvedValue({ note });

    const user = userEvent.setup();
    renderWorkspacePage();

    await waitFor(() => screen.getByText('Export Test Note'));
    await user.click(screen.getByText('Export Test Note'));
    await waitFor(() => screen.getByTestId('export-button'));

    await user.click(screen.getByTestId('export-button'));

    expect(mockExportNote).toHaveBeenCalledWith('Export Test Note', '# Hello\n\nworld');
  });
});
