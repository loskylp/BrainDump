/**
 * Unit tests for GET /api/notes/export route handler (TASK-029).
 *
 * Verifies the route contract:
 *   - Returns 401 when unauthenticated
 *   - Returns Content-Type application/zip on success
 *   - Returns Content-Disposition header with filename pattern
 *     braindump-export-{username}-{YYYY-MM-DD}.zip
 *   - Streams a valid ZIP body for notes with content
 *   - Streams a valid ZIP body for zero notes
 *   - Delegates to noteService.getAllNotesWithFolders with session userId
 *   - Each .md file in the ZIP contains the raw note body
 *   - Root notes are placed at ZIP root; notes with folders are in subdirectories
 *   - Filename sanitization: invalid characters replaced with hyphens
 *   - Empty/whitespace-only title falls back to "untitled"
 *   - Filename collisions resolved with numeric suffix (-2, -3, etc.)
 *   - Cross-directory collisions are independent (no false conflicts)
 *   - Folder name sanitization applied (invalid chars replaced with hyphens)
 *   - Propagates unexpected service errors via next(err)
 *
 * noteService is mocked — no database required.
 * authenticate and rlsContext middleware are mocked to isolate route logic.
 * adm-zip is used to parse and inspect the ZIP response body.
 *
 * REQ-020: AC-1 through AC-9
 * ADR-011: streaming ZIP via backend endpoint
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
  getUserById: jest.fn().mockResolvedValue({ username: 'testuser' }),
}));

jest.mock('../../src/services/tagService', () => ({
  getNotesWithTags: jest.fn(),
  createTag: jest.fn(),
  deleteTag: jest.fn(),
  addTagToNote: jest.fn(),
  removeTagFromNote: jest.fn(),
}));

// Mock authenticate: allow all requests by default with a test userId.
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, res, next) => {
    req.session = { userId: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  })
);

// Mock rlsContext: no-op
jest.mock('../../src/middleware/rateLimiter', () => jest.fn((_req, _res, next) => next()));
jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
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
const FOLDER_ID = 'cccccccc-0000-0000-0000-000000000005';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Express app mounting the notes router.
 * @returns {express.Application}
 */
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

/**
 * Returns a note-like object as returned by noteService.getAllNotesWithFolders.
 * folder is null for root notes; folder is an object with name for foldered notes.
 * @param {object} overrides
 */
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
 * Makes a supertest request to GET /api/notes/export and returns the response
 * body as a Buffer (raw bytes). This is required to parse the ZIP stream.
 *
 * @param {express.Application} app
 * @returns {Promise<{ status: number, headers: object, body: Buffer }>}
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
 * Parses a ZIP buffer and returns an object mapping entry names to their
 * UTF-8 string content. Directory entries are excluded.
 *
 * @param {Buffer} buf
 * @returns {Record<string, string>}
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

describe('GET /api/notes/export (TASK-029)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    noteService.getUserById.mockResolvedValue({ username: 'testuser' });
    authenticate.mockImplementation((req, _res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    app = buildApp();
  });

  // -------------------------------------------------------------------------
  // Authentication enforcement
  // -------------------------------------------------------------------------

  describe('authentication enforcement', () => {
    it('returns 401 when the request has no session', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(401);
    });

    it('does not call getAllNotesWithFolders when unauthenticated', async () => {
      authenticate.mockImplementation((_req, res, _next) => {
        res.status(401).json({ error: 'Authentication required' });
      });
      app = buildApp();

      await request(app).get('/api/notes/export');

      expect(noteService.getAllNotesWithFolders).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Response headers
  // -------------------------------------------------------------------------

  describe('response headers', () => {
    it('returns Content-Type application/zip', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/zip/);
    });

    it('returns Content-Disposition header with attachment disposition', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('returns Content-Disposition filename matching braindump-export-{username}-{YYYY-MM-DD}.zip', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.headers['content-disposition']).toMatch(
        /filename="braindump-export-testuser-\d{4}-\d{2}-\d{2}\.zip"/
      );
    });
  });

  // -------------------------------------------------------------------------
  // Service delegation
  // -------------------------------------------------------------------------

  describe('service delegation', () => {
    it('calls getAllNotesWithFolders with the session userId', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getAllNotesWithFolders).toHaveBeenCalledWith(USER_ID);
    });

    it('calls getAllNotesWithFolders exactly once per request', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      await request(app).get('/api/notes/export');

      expect(noteService.getAllNotesWithFolders).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // ZIP content — empty note collection
  // -------------------------------------------------------------------------

  describe('empty note collection', () => {
    it('returns 200 for zero notes', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(200);
    });

    it('returns a non-empty response body (valid ZIP bytes) for zero notes', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await getExportBuffer(app);

      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns a parseable ZIP with zero file entries for zero notes', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // ZIP content — root-level notes (no folder)
  // -------------------------------------------------------------------------

  describe('root-level notes', () => {
    it('places a root note at the ZIP root with {sanitized-title}.md', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'My Note', body: '# Hello', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('my-note.md');
    });

    it('includes the raw Markdown body as the .md file content', async () => {
      const body = '# Hello\n\nWorld content here.';
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'My Note', body, folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(entries['my-note.md']).toBe(body);
    });

    it('includes exactly one .md file for one root note', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Solo Note', body: 'content', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // ZIP content — notes in folders
  // -------------------------------------------------------------------------

  describe('notes in folders', () => {
    it('places a note inside a folder subdirectory: {folder-name}/{note-title}.md', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({
          title: 'Project Notes',
          body: 'Content',
          folder_id: FOLDER_ID,
          folder: { id: FOLDER_ID, name: 'Work' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('work/project-notes.md');
    });

    it('includes the raw Markdown body for a note in a folder', async () => {
      const body = '## Project\n\nDetails here.';
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({
          title: 'Project Notes',
          body,
          folder_id: FOLDER_ID,
          folder: { id: FOLDER_ID, name: 'Work' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(entries['work/project-notes.md']).toBe(body);
    });

    it('produces separate entries for root notes and foldered notes', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'note-r', title: 'Root Note', body: 'root', folder: null }),
        makeNote({
          id: 'note-f', title: 'Folder Note', body: 'folder',
          folder_id: FOLDER_ID, folder: { id: FOLDER_ID, name: 'Archive' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('root-note.md');
      expect(Object.keys(entries)).toContain('archive/folder-note.md');
    });
  });

  // -------------------------------------------------------------------------
  // Filename sanitization
  // -------------------------------------------------------------------------

  describe('filename sanitization', () => {
    it('replaces / in note title with hyphen', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Notes/Sub', body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      // Should produce exactly one file entry (not nested via the slash)
      expect(Object.keys(entries)).toHaveLength(1);
      // The file should end in .md and contain a hyphen where / was
      expect(Object.keys(entries)[0]).toMatch(/notes-sub\.md/);
    });

    it('replaces : in note title with hyphen', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: 'Note: Title', body: 'x', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      const key = Object.keys(entries)[0];
      expect(key).not.toContain(':');
      expect(key).toMatch(/\.md$/);
    });

    it('uses "untitled" for a note with an empty title', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: '', body: 'body', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('untitled.md');
    });

    it('uses "untitled" for a note with a whitespace-only title', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ title: '   ', body: 'body', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('untitled.md');
    });

    it('sanitizes folder names: replaces / in folder name with hyphen', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({
          title: 'Note',
          body: 'x',
          folder_id: FOLDER_ID,
          folder: { id: FOLDER_ID, name: 'My/Folder' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      const keys = Object.keys(entries);
      expect(keys).toHaveLength(1);
      // The directory segment should not be "My" (that would mean the slash was kept raw)
      const dirSegment = keys[0].split('/')[0];
      expect(dirSegment).not.toBe('My');
      expect(keys[0]).toMatch(/\.md$/);
    });
  });

  // -------------------------------------------------------------------------
  // Filename collision resolution
  // -------------------------------------------------------------------------

  describe('filename collision resolution', () => {
    it('appends -2 to the second note with the same sanitized title in the same directory', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'note-1', title: 'Duplicate', body: 'first', folder: null }),
        makeNote({ id: 'note-2', title: 'Duplicate', body: 'second', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('duplicate.md');
      expect(Object.keys(entries)).toContain('duplicate-2.md');
      expect(entries['duplicate.md']).toBe('first');
      expect(entries['duplicate-2.md']).toBe('second');
    });

    it('appends -3 to the third note with the same sanitized title in the same directory', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'note-1', title: 'Same', body: 'first', folder: null }),
        makeNote({ id: 'note-2', title: 'Same', body: 'second', folder: null }),
        makeNote({ id: 'note-3', title: 'Same', body: 'third', folder: null }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('same.md');
      expect(Object.keys(entries)).toContain('same-2.md');
      expect(Object.keys(entries)).toContain('same-3.md');
    });

    it('treats collisions in different directories as independent (no cross-directory conflict)', async () => {
      noteService.getAllNotesWithFolders.mockResolvedValue([
        makeNote({ id: 'note-1', title: 'Note', body: 'root', folder: null }),
        makeNote({
          id: 'note-2', title: 'Note', body: 'foldered',
          folder_id: FOLDER_ID, folder: { id: FOLDER_ID, name: 'Work' },
        }),
      ]);

      const res = await getExportBuffer(app);
      const entries = parseZipEntries(res.body);

      expect(Object.keys(entries)).toContain('note.md');
      expect(Object.keys(entries)).toContain('work/note.md');
      // Neither should have a -2 suffix; they are in different directories
      expect(Object.keys(entries)).not.toContain('note-2.md');
      expect(Object.keys(entries)).not.toContain('work/note-2.md');
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('returns 500 on unexpected service errors', async () => {
      noteService.getAllNotesWithFolders.mockRejectedValue(new Error('DB failure'));

      const res = await request(app).get('/api/notes/export');

      expect(res.status).toBe(500);
    });
  });
});
