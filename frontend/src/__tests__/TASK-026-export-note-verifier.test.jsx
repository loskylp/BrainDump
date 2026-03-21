/**
 * Verifier Acceptance Tests — TASK-026: Export notes as Markdown
 * (Canonical test; reference copy at tests/acceptance/TASK-026-export-note-verifier.test.js)
 *
 * REQ-019: Export notes as Markdown
 *
 * Part 1 of 2: exportNote / sanitizeFilename pure-function acceptance tests.
 * Part 2 (WorkspacePage button wiring) lives in
 * TASK-026-export-button-verifier.test.jsx.
 *
 * Acceptance criteria covered (REQ-019 GWT scenarios):
 *
 *   AC-1  Happy path — title "My Research Notes" → filename "my-research-notes.md",
 *         file contains exact raw Markdown body.
 *   AC-2  Filename sanitization — special chars removed, spaces → hyphens, lowercased.
 *   AC-3  Empty body — export succeeds; file is produced (does not throw or skip).
 *   AC-4  No backend call — export uses Blob/URL mechanism, no fetch/XHR.
 *   AC-6  Long title truncation — filename stem capped at 100 characters.
 *   AC-7  [VERIFIER-ADDED] All-special-char title → "untitled.md" fallback.
 *   AC-8  [VERIFIER-ADDED] Whitespace-only title → "untitled.md" fallback.
 *   AC-9  [VERIFIER-ADDED] Blob type is text/markdown (not text/plain or text/html).
 *   AC-10 [VERIFIER-ADDED] URL.revokeObjectURL is called after download trigger
 *         (memory-leak guard).
 *
 * Negative cases:
 *   NC-1  sanitizeFilename returns "untitled" for empty input, NOT the empty string.
 *   NC-2  sanitizeFilename returns a slug, NOT the raw title with spaces or punctuation.
 *   NC-3  Blob type must be exactly "text/markdown", NOT "text/plain".
 *   NC-4  URL.revokeObjectURL must be called; a no-op implementation would leak memory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportNote, sanitizeFilename } from '../utils/exportNote.js';

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
// AC-1: Happy path
// REQ-019 GWT: Given note "My Research Notes" / When Export clicked / Then
//   "my-research-notes.md" downloaded with exact raw Markdown body
// ---------------------------------------------------------------------------

describe('REQ-019 AC-1: Happy path export', () => {
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
// REQ-019 GWT: Given "Notes: Week 3 (Draft!)" / When Export / Then
//   "notes-week-3-draft.md"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-2: Filename sanitization', () => {
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

  it('removes punctuation not in [a-z0-9-]', () => {
    expect(sanitizeFilename('My Note!')).toBe('my-note');
  });

  it('collapses multiple consecutive hyphens', () => {
    expect(sanitizeFilename('My  Note')).toBe('my-note');
  });

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeFilename('!Hello!')).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// NC-1 (negative): empty title must NOT produce empty filename
// ---------------------------------------------------------------------------

describe('REQ-019 NC-1: Empty title falls back to "untitled", not empty string', () => {
  it('returns "untitled" for empty string — not empty', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('')).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// AC-7 [VERIFIER-ADDED]: All-special-char title → "untitled.md"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-7 [VERIFIER-ADDED]: All-special-char title', () => {
  // Given: note titled "!!!" / When: exportNote called / Then: "untitled.md"
  it('uses "untitled.md" for a title of all special characters', () => {
    exportNote('!!!', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });
});

// ---------------------------------------------------------------------------
// AC-8 [VERIFIER-ADDED]: Whitespace-only title → "untitled.md"
// ---------------------------------------------------------------------------

describe('REQ-019 AC-8 [VERIFIER-ADDED]: Whitespace-only title', () => {
  // Given: note titled "   " / When: exportNote called / Then: "untitled.md"
  it('uses "untitled.md" for a whitespace-only title', () => {
    exportNote('   ', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });
});

// ---------------------------------------------------------------------------
// AC-3: Empty body — export must not fail or silently skip
// REQ-019 GWT: Given empty body / When Export / Then .md file still downloaded
// ---------------------------------------------------------------------------

describe('REQ-019 AC-3: Empty body export does not fail', () => {
  it('does not throw when body is empty string', () => {
    expect(() => exportNote('My Note', '')).not.toThrow();
  });

  it('still creates a Blob even when body is empty', () => {
    exportNote('My Note', '');
    expect(createdBlob).toBeInstanceOf(Blob);
  });

  it('still triggers the download anchor even when body is empty', () => {
    exportNote('My Note', '');
    expect(createdAnchor).not.toBeNull();
    expect(createdAnchor.download).toBe('my-note.md');
  });
});

// ---------------------------------------------------------------------------
// AC-4: No backend call
// REQ-019 GWT: Given loaded note / When Export / Then no network request
// ---------------------------------------------------------------------------

describe('REQ-019 AC-4: No backend network request during export', () => {
  it('does not call window.fetch during export', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({});
    exportNote('My Note', '# Content');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('uses URL.createObjectURL (Blob) not a network URL', () => {
    exportNote('My Note', '# Content');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createdAnchor.href).toContain('blob:');
    expect(createdAnchor.href).not.toMatch(/^https?:\/\//);
  });
});

// ---------------------------------------------------------------------------
// AC-9 [VERIFIER-ADDED]: Blob MIME type must be text/markdown
// NC-3 (negative): must NOT be text/plain or text/html
// ---------------------------------------------------------------------------

describe('REQ-019 AC-9 [VERIFIER-ADDED]: Blob type is text/markdown', () => {
  // Given: any note export / When: Blob created / Then: type === 'text/markdown'
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
// AC-10 [VERIFIER-ADDED]: URL.revokeObjectURL called after download
// NC-4 (negative): omitting revoke leaks memory — must be called
// ---------------------------------------------------------------------------

describe('REQ-019 AC-10 [VERIFIER-ADDED]: Object URL revoked after download', () => {
  // Given: export triggered / When: exportNote returns / Then: revokeObjectURL called
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
// REQ-019 GWT: Given 200-char title / When Export / Then stem ≤ 100 chars
// ---------------------------------------------------------------------------

describe('REQ-019 AC-6: Long title truncated to ≤100 chars before ".md"', () => {
  it('produces a 100-char stem for a 120-char alpha title', () => {
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
