/**
 * Unit tests for frontend/src/utils/exportNote.js (TASK-026).
 *
 * exportNote(title, body) triggers a client-side .md file download using the
 * Blob/URL.createObjectURL mechanism. URL.createObjectURL and
 * URL.revokeObjectURL are not available in jsdom and are mocked here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportNote, sanitizeFilename } from '../utils/exportNote.js';

// ---------------------------------------------------------------------------
// Mock browser download APIs unavailable in jsdom
// ---------------------------------------------------------------------------

let mockObjectUrl;
let createdBlob;
let createdAnchor;

beforeEach(() => {
  mockObjectUrl = 'blob:http://localhost/mock-uuid';

  // Capture the Blob passed to createObjectURL for inspection
  URL.createObjectURL = vi.fn((blob) => {
    createdBlob = blob;
    return mockObjectUrl;
  });

  URL.revokeObjectURL = vi.fn();

  // Intercept anchor creation so we can inspect the download attribute
  // and prevent actual DOM mutations / navigation in jsdom
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
// sanitizeFilename — pure function; tested independently
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
  it('lowercases the title', () => {
    expect(sanitizeFilename('Hello')).toBe('hello');
  });

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('My Note')).toBe('my-note');
  });

  it('removes characters not in [a-z0-9-]', () => {
    expect(sanitizeFilename('My Note!')).toBe('my-note');
  });

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('My  Note')).toBe('my-note');
  });

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeFilename('!Hello!')).toBe('hello');
  });

  it('handles title with only special characters by returning "untitled"', () => {
    expect(sanitizeFilename('!!!')).toBe('untitled');
  });

  it('handles empty string by returning "untitled"', () => {
    expect(sanitizeFilename('')).toBe('untitled');
  });

  it('handles whitespace-only string by returning "untitled"', () => {
    expect(sanitizeFilename('   ')).toBe('untitled');
  });

  it('truncates to 100 characters', () => {
    const longTitle = 'a'.repeat(120);
    expect(sanitizeFilename(longTitle)).toHaveLength(100);
  });

  it('trims hyphens that appear after truncation', () => {
    // Build a title whose 100-char sanitized form ends with a hyphen
    // e.g. 99 'a' chars + space + more chars — after truncation at 100 the
    // space-turned-hyphen at position 100 is trimmed
    const title = 'a'.repeat(99) + ' extra content';
    const result = sanitizeFilename(title);
    expect(result.endsWith('-')).toBe(false);
    expect(result.length).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// exportNote — Blob creation and download trigger
// ---------------------------------------------------------------------------

describe('exportNote', () => {
  it('creates a Blob with type text/markdown', () => {
    exportNote('My Note', 'body content');
    expect(createdBlob).toBeInstanceOf(Blob);
    expect(createdBlob.type).toBe('text/markdown');
  });

  it('passes the body string as-is to the Blob', () => {
    const body = '# Heading\n\nSome **bold** text';
    // Spy on the Blob constructor to capture the parts array
    const originalBlob = globalThis.Blob;
    let capturedParts;
    globalThis.Blob = vi.fn(function (parts, options) {
      capturedParts = parts;
      return new originalBlob(parts, options);
    });

    exportNote('Note', body);

    expect(capturedParts).toEqual([body]);
    globalThis.Blob = originalBlob;
  });

  it('uses "my-note.md" as the filename for title "My Note!"', () => {
    exportNote('My Note!', 'body');
    expect(createdAnchor.download).toBe('my-note.md');
  });

  it('uses "untitled.md" for a whitespace-only title', () => {
    exportNote('   ', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });

  it('uses "untitled.md" for an empty title', () => {
    exportNote('', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });

  it('uses "untitled.md" for a title with only special characters', () => {
    exportNote('!!!', 'body');
    expect(createdAnchor.download).toBe('untitled.md');
  });

  it('truncates a very long title to 100 chars plus ".md"', () => {
    const longTitle = 'a'.repeat(120);
    exportNote(longTitle, 'body');
    expect(createdAnchor.download).toBe('a'.repeat(100) + '.md');
  });

  it('exports an empty file without error when body is empty', () => {
    expect(() => exportNote('My Note', '')).not.toThrow();
    expect(createdBlob).toBeInstanceOf(Blob);
  });

  it('calls URL.createObjectURL with the Blob', () => {
    exportNote('My Note', 'body');
    expect(URL.createObjectURL).toHaveBeenCalledWith(createdBlob);
  });

  it('calls URL.revokeObjectURL after the download is triggered', () => {
    exportNote('My Note', 'body');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
  });

  it('sets the href of the anchor to the object URL', () => {
    exportNote('My Note', 'body');
    expect(createdAnchor.href).toContain('blob:');
  });
});
