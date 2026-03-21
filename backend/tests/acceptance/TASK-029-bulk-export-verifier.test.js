/**
 * Verifier Acceptance Tests — TASK-029: Bulk ZIP export backend
 *
 * REQ-020: Full export to ZIP
 *
 * These tests verify the backend GET /api/notes/export endpoint at the
 * acceptance layer. All tests operate on the Express route through supertest
 * (public HTTP interface) with a mocked noteService and authenticate
 * middleware. No database is required.
 *
 * Acceptance criteria from TASK-029 that are in scope for this backend-only
 * verification (AC-7 and AC-8 are frontend tasks deferred to a separate task):
 *
 *   AC-1  Content-Type is application/zip; Content-Disposition filename matches
 *         braindump-export-{username}-{YYYY-MM-DD}.zip
 *   AC-2  ZIP contains one .md file per note owned by the authenticated user
 *   AC-3  Notes in folders placed in subdirectories; root-level notes at ZIP root
 *   AC-4  Each .md file contains the note's raw Markdown body (current content only)
 *   AC-5  Filenames derived from note titles, sanitized for filesystem safety
 *   AC-6  Filename collisions resolved with numeric suffix (-2, -3, ...)
 *   AC-9  Per-user isolation: export returns only the authenticated user's notes
 *   AC-10 Exporting with 0 notes returns a valid empty ZIP (200, parseable, 0 entries)
 *
 * Negative cases ensuring non-trivial pass are included throughout. A test
 * that accepts a trivially permissive implementation (e.g., always returns 200)
 * is strengthened with at least one negative or boundary assertion.
 *
 * Verifier-added tests are tagged [VERIFIER-ADDED] in the test name.
 *
 * REQ-020: AC-1 through AC-6, AC-9, AC-10
 * ADR-011: streaming ZIP via backend endpoint placed before /:id routes
 */

'use strict';

const request = require('supertest');
const express = require('express');
const AdmZip = require('adm-zip');

// ---------------------------------------------------------------------------
// Mock noteService before importing the router
// ---------------------------------------------------------------------------

jest.mock('../../src/services/noteService', () => ({
  createNote: jest.fn(),
  getNotes: jest.fn(),
  getNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
  getAllNotesWithFolders: jest.fn(),
  getUserById: jest.fn().mockResolvedValue({ username: 'alice' }),
}));

jest.mock('../../src/services/tagService', () => ({
  getNotesWithTags: jest.fn(),
  createTag: jest.fn(),
  deleteTag: jest.fn(),
  getTags: jest.fn(),
  addTagToNote: jest.fn(),
  removeTagFromNote: jest.fn(),
}));

// Mock authenticate: inject a test session by default.
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, res, next) => {
    req.session = { userId: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  })
);

// Mock rlsContext: no-op.
jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

// Mock ownershipGuard: no-op (not used by /export but required by other routes in the same file).
jest.mock('../../src/middleware/ownershipGuard', () =>
  jest.fn(() => (_req, _res, next) => next())
);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const notesRouter = require('../../src/routes/notes');
const noteService = require('../../src/services/noteService');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const FOLDER_A_ID = 'cccccccc-0000-0000-0000-000000000010';
const FOLDER_B_ID = 'dddddddd-0000-0000-0000-000000000020';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', notesRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: err.message });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(overrides = {}) {
  return {
    id: 'note-id-1',
    title: 'My Note',
    body: '# Hello\n\nWorld',
    folder_id: null,
    folder: null,
    ...overrides,
  };
}

/**
 * Fetches GET /api/notes/export and returns the response body as a Buffer.
 */
async function getExportBuffer(app) {
  const res = await request(app)
    .get('/api/notes/export')
    .buffer(true)
    .parse((res, callback) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
    });
  return res;
}

/**
 * Parses a ZIP buffer and returns an object mapping entry name to UTF-8 content.
 * Directory entries are excluded.
 */
function parseZipEntries(buf) {
  const zip = new AdmZip(buf);
  const entries = {};
  zip.getEntries().forEach((entry) => {
    if (!entry.isDirectory) {
      entries[entry.entryName] = entry.getData().toString('utf8');
    }
  });
  return entries;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-029: GET /api/notes/export — bulk ZIP export', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    noteService.getUserById.mockResolvedValue({ username: 'alice' });
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    app = buildApp();
  });

  // =========================================================================
  // AC-1: Content-Type application/zip; Content-Disposition filename pattern
  // REQ-020 GWT: "When the ZIP download completes Then the ZIP filename follows
  //   the pattern braindump-export-{username}-{YYYY-MM-DD}.zip"
  // =========================================================================

  describe('AC-1: response headers', () => {
    // Given: an authenticated user
    // When: GET /api/notes/export
    // Then: Content-Type is application/zip

    it('AC-1 — returns Content-Type application/zip', async () => {
      // REQ-020
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/zip/);
    });

    it('AC-1 — Content-Type is NOT text/html or text/plain (negative)', async () => {
      // REQ-020 — guard against a trivially permissive handler
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.headers['content-type']).not.toMatch(/text\/html/);
      expect(res.headers['content-type']).not.toMatch(/text\/plain/);
    });

    it('AC-1 — Content-Disposition is attachment (not inline)', async () => {
      // REQ-020
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('AC-1 — filename in Content-Disposition matches braindump-export-{username}-{YYYY-MM-DD}.zip', async () => {
      // REQ-020 GWT: ZIP filename follows the pattern
      noteService.getAllNotesWithFolders.mockResolvedValue([]);
      noteService.getUserById.mockResolvedValue({ username: 'alice' });

      const res = await request(app).get('/api/notes/export');

      // Pattern: braindump-export-alice-YYYY-MM-DD.zip
      expect(res.headers['content-disposition']).toMatch(
        /filename="braindump-export-alice-\d{4}-\d{2}-\d{2}\.zip"/
      );
    });

    it("[VERIFIER-ADDED] AC-1 — filename uses the authenticated user's username, not a hardcoded value", async () => {
      // REQ-020 — isolation check: Bob's export must use Bob's username
      noteService.getAllNotesWithFolders.mockResolvedValue([]);
      noteService.getUserById.mockResolvedValue({ username: 'bob' });
      authenticate.mockImplementation((req, _res, next) => {
        req.session = { userId: OTHER_USER_ID };
        next();
      });
      app = buildApp();

      const res = await request(app).get('/api/notes/export');

      expect(res.headers['content-disposition']).toMatch(
        /filename="braindump-export-bob-\d{4}-\d{2}-\d{2}\.zip"/
      );
      // Must NOT contain alice's username
      expect(res.headers['content-disposition']).not.toMatch(/alice/);
    });

    it('[VERIFIER-ADDED] AC-1 — unauthenticated request returns 401, not a ZIP', async () => {
      // REQ-020 negative: unauthenticated requests must not receive a ZIP
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(401);
      expect(res.headers['content-type']).not.toMatch(/application\/zip/);
      expect(noteService.getAllNotesWithFolders).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // AC-2: ZIP contains one .md file per note owned by the authenticated user
  // REQ-020 GWT: "5 notes ... containing 3 .md files at ZIP root ... 2 .md files in Research/"
  // =========================================================================

  describe('AC-2: complete note collection — one .md per note', () => {
    it('AC-2 — ZIP contains exactly one .md file for a single-note collection', async () => {
      // REQ-020
      // Given: authenticated user with 1 note
      // When: GET /api/notes/export
      // Then: ZIP contains exactly 1 .md entry
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Solo Note', body: 'content' }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toHaveLength(1);
    });

    it('AC-2 — ZIP contains one .md file per note (5 notes = 5 entries)', async () => {
      // REQ-020 GWT scenario: 3 root + 2 in folder
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Alpha', body: 'a', folder: null }),
        makeNote({ id: 'n2', title: 'Beta', body: 'b', folder: null }),
        makeNote({ id: 'n3', title: 'Gamma', body: 'g', folder: null }),
        makeNote({ id: 'n4', title: 'Research One', body: 'r1', folder_id: FOLDER_A_ID, folder: { id: FOLDER_A_ID, name: 'Research' } }),
        makeNote({ id: 'n5', title: 'Research Two', body: 'r2', folder_id: FOLDER_A_ID, folder: { id: FOLDER_A_ID, name: 'Research' } }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toHaveLength(5);
    });

    it("AC-2 — getAllNotesWithFolders is called with the authenticated user's ID (user isolation)", async () => {
      // REQ-020 AC-9: per-user isolation — only the auth user's notes fetched
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getAllNotesWithFolders).toHaveBeenCalledWith(USER_ID);
      expect(noteService.getAllNotesWithFolders).toHaveBeenCalledTimes(1);
    });

    it("[VERIFIER-ADDED] AC-2 — getAllNotesWithFolders is NOT called with another user's ID", async () => {
      // REQ-020 negative: the query must not use a different userId
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getAllNotesWithFolders).not.toHaveBeenCalledWith(OTHER_USER_ID);
    });
  });

  // =========================================================================
  // AC-3: Notes in folders placed in subdirectories; root notes at ZIP root
  // REQ-020 GWT: "a 'Research/' directory containing 2 .md files"
  // =========================================================================

  describe('AC-3: folder-based directory structure', () => {
    it('AC-3 — root note is placed at ZIP root (no directory prefix)', async () => {
      // REQ-020
      // Given: note with no folder
      // When: export
      // Then: entry path has no slash
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Root Note', body: 'root content', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const keys = Object.keys(entries);

      expect(keys).toHaveLength(1);
      expect(keys[0]).not.toContain('/');
      expect(keys[0]).toMatch(/\.md$/);
    });

    it('AC-3 — foldered note is placed under a subdirectory named after the folder', async () => {
      // REQ-020 GWT: notes in folder "Research" appear under "research/"
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({
          title: 'My Research',
          body: 'data',
          folder_id: FOLDER_A_ID,
          folder: { id: FOLDER_A_ID, name: 'Research' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const keys = Object.keys(entries);

      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatch(/^research\//);
      expect(keys[0]).toMatch(/\.md$/);
    });

    it('AC-3 — root notes and foldered notes land in separate paths (no mixing)', async () => {
      // REQ-020 GWT: 3 root + 2 in folder
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Root A', body: 'ra', folder: null }),
        makeNote({ id: 'n2', title: 'Folder Note', body: 'fn', folder_id: FOLDER_A_ID, folder: { id: FOLDER_A_ID, name: 'Work' } }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('root-a.md');
      expect(Object.keys(entries)).toContain('work/folder-note.md');
    });

    it('[VERIFIER-ADDED] AC-3 — notes from two different folders appear in separate subdirectories', async () => {
      // REQ-020 — more than one folder must produce separate directories
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Note A', body: 'a', folder_id: FOLDER_A_ID, folder: { id: FOLDER_A_ID, name: 'Alpha' } }),
        makeNote({ id: 'n2', title: 'Note B', body: 'b', folder_id: FOLDER_B_ID, folder: { id: FOLDER_B_ID, name: 'Beta' } }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('alpha/note-a.md');
      expect(Object.keys(entries)).toContain('beta/note-b.md');
      // Must not accidentally merge into one directory
      expect(Object.keys(entries)).not.toContain('alpha/note-b.md');
      expect(Object.keys(entries)).not.toContain('beta/note-a.md');
    });
  });

  // =========================================================================
  // AC-4: Each .md file contains the note's raw Markdown body (no HTML)
  // REQ-020 GWT: "every .md file contains raw Markdown (not rendered HTML)"
  // =========================================================================

  describe('AC-4: raw Markdown body content', () => {
    it('AC-4 — .md file content is the exact raw Markdown body', async () => {
      // REQ-020
      // Given: note with Markdown body
      // When: export
      // Then: file content === raw body string
      const rawBody = '# Heading\n\nParagraph with **bold** and _italic_.\n\n- item 1\n- item 2';
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Markdown Note', body: rawBody, folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(entries['markdown-note.md']).toBe(rawBody);
    });

    it('[VERIFIER-ADDED] AC-4 — body does NOT contain rendered HTML tags (no <h1>, <p>, <strong>)', async () => {
      // REQ-020 negative: export must not HTML-render the Markdown
      const rawBody = '# Heading\n\n**bold**';
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Raw Check', body: rawBody, folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const content = entries['raw-check.md'];

      expect(content).not.toMatch(/<h1>/);
      expect(content).not.toMatch(/<strong>/);
      expect(content).not.toMatch(/<p>/);
      expect(content).toBe(rawBody);
    });

    it('[VERIFIER-ADDED] AC-4 — note with empty body produces a .md file with empty content (not null/undefined)', async () => {
      // REQ-020 — empty body is valid
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Empty Note', body: '', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('empty-note.md');
      expect(entries['empty-note.md']).toBe('');
    });
  });

  // =========================================================================
  // AC-5: Filenames sanitized for filesystem safety (same rules as REQ-019)
  // REQ-020 GWT: "filenames are filesystem-safe on Windows, macOS, and Linux"
  // =========================================================================

  describe('AC-5: filename sanitization', () => {
    const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

    it.each(invalidChars)(
      'AC-5 — character %s in title is replaced (not preserved in filename)',
      async (char) => {
        // REQ-020
        noteService.getAllNotesWithFolders.mockResolvedValue([
          makeNote({ title: `Note${char}Title`, body: 'x', folder: null }),
        ]);

        const res = await getExportBuffer(app);
        const entries = parseZipEntries(res.body);
        const key = Object.keys(entries)[0];

        // The invalid character must not appear in the filename portion
        expect(key).not.toContain(char);
        expect(key).toMatch(/\.md$/);
        // Entry must be a file (not create a nested directory from the char)
        expect(Object.keys(entries)).toHaveLength(1);
      }
    );

    it('AC-5 — filename is lowercased', async () => {
      // REQ-020 — lowercase rule
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'My Great Note', body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const key = Object.keys(entries)[0];

      expect(key).toBe(key.toLowerCase());
    });

    it('AC-5 — whitespace in title is replaced with hyphens, not preserved as spaces', async () => {
      // REQ-020 negative: spaces must not appear in filenames
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'hello world note', body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const key = Object.keys(entries)[0];

      expect(key).not.toContain(' ');
      expect(key).toBe('hello-world-note.md');
    });

    it('AC-5 — consecutive hyphens are collapsed to a single hyphen', async () => {
      // REQ-020 — hyphen collapsing rule
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'A  --  B', body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const key = Object.keys(entries)[0];

      expect(key).not.toMatch(/--/);
    });

    it('AC-5 — title that sanitizes to empty uses "untitled" fallback', async () => {
      // REQ-020 — fallback rule
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: '///???', body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('untitled.md');
    });

    it('[VERIFIER-ADDED] AC-5 — filename is truncated to 100 characters before .md extension', async () => {
      // REQ-020 — truncation rule (same as REQ-019)
      const longTitle = 'a'.repeat(200);
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: longTitle, body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const key = Object.keys(entries)[0];
      const stem = key.replace(/\.md$/, '');

      expect(stem.length).toBeLessThanOrEqual(100);
    });

    it('[VERIFIER-ADDED] AC-5 — folder name is also sanitized (/ in folder name does not create extra nesting)', async () => {
      // REQ-020 — folder sanitization
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({
          title: 'Note',
          body: 'x',
          folder_id: FOLDER_A_ID,
          folder: { id: FOLDER_A_ID, name: 'My/Folder' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);
      const keys = Object.keys(entries);

      // Exactly one file entry (not a deeply nested path from the raw /)
      expect(keys).toHaveLength(1);
      // The directory segment must not be "My" (which would mean / was kept raw)
      const dirSegment = keys[0].split('/')[0];
      expect(dirSegment).not.toBe('My');
    });
  });

  // =========================================================================
  // AC-6: Filename collisions resolved with numeric suffix
  // REQ-020 GWT: "meeting-notes.md" and "meeting-notes-2.md"
  // =========================================================================

  describe('AC-6: collision resolution', () => {
    it('AC-6 — two notes with the same sanitized title: first keeps name, second gets -2', async () => {
      // REQ-020 GWT: "meeting-notes.md" and "meeting-notes-2.md"
      // Given: two root notes both titled "Meeting Notes"
      // When: export
      // Then: ZIP contains meeting-notes.md and meeting-notes-2.md
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Meeting Notes', body: 'first meeting', folder: null }),
        makeNote({ id: 'n2', title: 'Meeting Notes', body: 'second meeting', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('meeting-notes.md');
      expect(Object.keys(entries)).toContain('meeting-notes-2.md');
      expect(entries['meeting-notes.md']).toBe('first meeting');
      expect(entries['meeting-notes-2.md']).toBe('second meeting');
    });

    it('[VERIFIER-ADDED] AC-6 — three notes with the same sanitized title get -2 and -3', async () => {
      // REQ-020 — three-way collision
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Same', body: 'one', folder: null }),
        makeNote({ id: 'n2', title: 'Same', body: 'two', folder: null }),
        makeNote({ id: 'n3', title: 'Same', body: 'three', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('same.md');
      expect(Object.keys(entries)).toContain('same-2.md');
      expect(Object.keys(entries)).toContain('same-3.md');
      expect(Object.keys(entries)).toHaveLength(3);
    });

    it('AC-6 — same title in different directories does NOT trigger collision (independent per-dir)', async () => {
      // REQ-020 — collision tracking is per-directory
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Note', body: 'root', folder: null }),
        makeNote({
          id: 'n2', title: 'Note', body: 'folder',
          folder_id: FOLDER_A_ID, folder: { id: FOLDER_A_ID, name: 'Archive' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      // Both use the base name (no -2 suffix) because they are in different directories
      expect(Object.keys(entries)).toContain('note.md');
      expect(Object.keys(entries)).toContain('archive/note.md');
      expect(Object.keys(entries)).not.toContain('note-2.md');
      expect(Object.keys(entries)).not.toContain('archive/note-2.md');
    });
  });

  // =========================================================================
  // AC-9: Per-user isolation — export returns only the authenticated user's notes
  // REQ-020: "Per-user isolation: export endpoint returns only the authenticated user's notes"
  // =========================================================================

  describe('AC-9: per-user isolation', () => {
    it('AC-9 — getUserById is called with the session userId to resolve the username', async () => {
      // REQ-020
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getUserById).toHaveBeenCalledWith(USER_ID);
    });

    it("[VERIFIER-ADDED] AC-9 — getUserById is NOT called with another user's ID", async () => {
      // REQ-020 negative: must scope to the authenticated user
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getUserById).not.toHaveBeenCalledWith(OTHER_USER_ID);
    });

    it("AC-9 — getAllNotesWithFolders is called with the authenticated user's ID only", async () => {
      // REQ-020 — user isolation in the data fetch
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getAllNotesWithFolders).toHaveBeenCalledWith(USER_ID);
      expect(noteService.getAllNotesWithFolders).not.toHaveBeenCalledWith(OTHER_USER_ID);
    });
  });

  // =========================================================================
  // AC-10: 0-note export returns a valid empty ZIP (200, parseable, 0 entries)
  // REQ-020 GWT: "with no notes ... produces an empty ZIP"
  // =========================================================================

  describe('AC-10: empty collection — valid empty ZIP', () => {
    it('AC-10 — 0 notes: returns HTTP 200', async () => {
      // REQ-020
      // Given: authenticated user with no notes
      // When: GET /api/notes/export
      // Then: HTTP 200 (not 204, not 404)
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(200);
    });

    it('AC-10 — 0 notes: response body is a non-empty Buffer (valid ZIP bytes)', async () => {
      // REQ-020 — a valid empty ZIP still has end-of-central-directory record
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await getExportBuffer(app);

      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('AC-10 — 0 notes: ZIP parses without error and contains zero file entries', async () => {
      // REQ-020
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toHaveLength(0);
    });

    it('[VERIFIER-ADDED] AC-10 — 0 notes: Content-Type and Content-Disposition headers still present', async () => {
      // REQ-020 — headers must be correct even for empty exports
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.headers['content-type']).toMatch(/application\/zip/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });
  });

  // =========================================================================
  // Route ordering: /export must be matched before /:id
  // ADR-011: route placement critical to avoid Express matching "export" as UUID
  // =========================================================================

  describe('[VERIFIER-ADDED] route ordering — /export is not shadowed by /:id', () => {
    it('GET /api/notes/export resolves to the export handler, not the /:id handler', async () => {
      // ADR-011: /export must be declared before /:id in the router
      // Proof: getAllNotesWithFolders is called (export handler) and
      // getNote (the /:id handler) is NOT called.
      noteService.getAllNotesWithFolders.mockResolvedValue([]);
      noteService.getNote = jest.fn(); // should NOT be called

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(200);
      expect(noteService.getAllNotesWithFolders).toHaveBeenCalledTimes(1);
      expect(noteService.getNote).not.toHaveBeenCalled();
    });
  });
});
