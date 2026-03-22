/**
 * Notes routes.
 *
 * CRUD endpoints for user-owned notes. All routes require authentication.
 * Ownership enforcement is applied via ownershipGuard on single-resource
 * routes. Collection routes rely on noteService's user-scoped queries plus
 * the RLS context set by rlsContext middleware.
 *
 * Auto-save path: PUT /api/notes/:id (TASK-009)
 * Version check path: POST /api/notes/:id/check-version (in versions.js)
 * Bulk export path: GET /api/notes/export (TASK-029)
 */

'use strict';

const express = require('express');
const archiver = require('archiver');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const ownershipGuard = require('../middleware/ownershipGuard');
const rlsContext = require('../middleware/rlsContext');
const noteService = require('../services/noteService');
const tagService = require('../services/tagService');
const rateLimiter = require('../middleware/rateLimiter');

// Apply authentication and RLS context to all notes routes
router.use(authenticate);
router.use(rlsContext);

/**
 * GET /api/notes
 *
 * Returns all notes belonging to the authenticated user, sorted by updated_at DESC.
 * Optionally filters by tag IDs (OR logic) via ?tags=id1,id2 query parameter.
 *
 * @returns {200} { notes: Array<{ id, title, updated_at, folder_id, tags: Array<{ id, name }> }> }
 *   NOTE: body is excluded from list responses for performance.
 *
 * Postconditions:
 *   - Returns only notes where user_id = req.session.userId
 *   - Empty array when user has no notes (not 404)
 *   - When tags query param is provided, only notes matching ANY tag are returned (OR logic)
 */
router.get('/', async (req, res, next) => {
  try {
    const tagIds = req.query.tags ? req.query.tags.split(',').filter(Boolean) : null;
    const notes = await tagService.getNotesWithTags(req.session.userId, tagIds);
    res.json({ notes });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notes
 *
 * Creates a new note with an initial version.
 *
 * Request body:
 *   { title?: string, folderId?: string }
 *   title defaults to empty string if omitted.
 *
 * @returns {201} { note: { id, title, body, folder_id, created_at, updated_at } }
 * @returns {404} { error: "Not found" } -- folderId provided but not found or not owned by user
 *
 * Postconditions:
 *   - Note row persisted with user_id = req.session.userId
 *   - NoteVersion row with version_number=1 persisted in same transaction
 */
router.post('/', async (req, res, next) => {
  try {
    const { title = '', folderId } = req.body;
    const note = await noteService.createNote(req.session.userId, { title, folderId });
    res.status(201).json({ note });
  } catch (err) {
    if (err.message === 'FOLDER_NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

/**
 * GET /api/notes/export
 *
 * Streams a ZIP archive of all notes owned by the authenticated user.
 *
 * Each note is written as a `.md` file whose content is the raw Markdown body.
 * Notes assigned to a folder are placed in a subdirectory named after the folder
 * (sanitized for filesystem safety). Root-level notes are placed at the ZIP root.
 *
 * Filename sanitization rules (applied to both note titles and folder names):
 *   - Replace characters invalid in filenames (/ \ : * ? " < > |) with hyphen
 *   - Replace runs of whitespace with a single hyphen
 *   - Collapse consecutive hyphens to a single hyphen
 *   - Trim leading and trailing hyphens
 *   - Lowercase the result
 *   - Fall back to "untitled" (notes) or "unnamed-folder" (folders) if the
 *     sanitized result is empty
 *   - Truncate to 100 characters (before .md extension)
 *
 * Filename collision resolution: when two notes in the same directory produce
 * the same sanitized filename, the second is appended with `-2`, the third
 * with `-3`, and so on.
 *
 * Response headers:
 *   Content-Type: application/zip
 *   Content-Disposition: attachment; filename="braindump-export-{username}-{YYYY-MM-DD}.zip"
 *
 * @returns {200} ZIP byte stream
 * @returns {401} { error: "Authentication required" } — unauthenticated
 *
 * Route must be declared before /:id to prevent Express matching "export" as a
 * note ID parameter (ADR-011, TASK-029 implementation note).
 *
 * Preconditions:
 *   - req.session.userId references a valid, authenticated user
 * Postconditions:
 *   - ZIP contains only notes owned by the authenticated user (per-user isolation)
 *   - Each .md file content is the note's raw Markdown body (no HTML conversion)
 *   - An empty collection produces a valid ZIP with zero file entries
 */
router.get('/export', async (req, res, next) => {
  try {
    const userId = req.session.userId;

    const [user, notes] = await Promise.all([
      noteService.getUserById(userId),
      noteService.getAllNotesWithFolders(userId),
    ]);

    // Structured export frequency log (TASK-032, AC-2). Written to stdout.
    console.log(JSON.stringify({
      event: 'export',
      userId,
      note_count: notes.length,
    }));

    // SEC-015: strip characters that could break the Content-Disposition header
    // (newlines, carriage returns, quotes) before interpolating username.
    const rawUsername = user ? user.username : 'user';
    const safeUsername = rawUsername.replace(/[\r\n"]/g, '');
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const zipFilename = `braindump-export-${safeUsername}-${date}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    // Track used filenames per directory to detect and resolve collisions.
    // Key: directory path (empty string for root), Value: Set of basename strings.
    const usedNames = new Map();

    for (const note of notes) {
      const dir = note.folder ? sanitizePathSegment(note.folder.name, 'unnamed-folder') : '';
      const basename = sanitizePathSegment(note.title, 'untitled');

      if (!usedNames.has(dir)) {
        usedNames.set(dir, new Set());
      }
      const dirNames = usedNames.get(dir);

      const resolvedBasename = resolveCollision(basename, dirNames);
      dirNames.add(resolvedBasename);

      const entryPath = dir ? `${dir}/${resolvedBasename}.md` : `${resolvedBasename}.md`;
      archive.append(note.body || '', { name: entryPath });
    }

    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

/**
 * Sanitizes a string for use as a filesystem path segment (file or directory name).
 *
 * Applies the following transformations in order:
 *   1. Replace characters invalid in most filesystems (/ \ : * ? " < > |) with hyphen
 *   2. Replace runs of whitespace with a single hyphen
 *   3. Collapse consecutive hyphens to a single hyphen
 *   4. Trim leading and trailing hyphens
 *   5. Lowercase the result
 *   6. Truncate to 100 characters
 *   7. Return the fallback string if the result is empty
 *
 * @param {string} input - The raw string to sanitize
 * @param {string} fallback - Returned when the sanitized result is empty
 * @returns {string} A filesystem-safe, lowercase path segment
 */
function sanitizePathSegment(input, fallback) {
  let s = (input || '').trim();
  s = s.replace(/[/\\:*?"<>|]/g, '-');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-{2,}/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  s = s.toLowerCase();
  s = s.slice(0, 100);
  return s || fallback;
}

/**
 * Resolves a filename collision within a directory by appending a numeric suffix.
 *
 * Given a desired basename and the set of basenames already used in the same
 * directory, returns the basename unchanged if it is not yet taken. If it is
 * taken, appends `-2`, then `-3`, and so on until an unused name is found.
 *
 * @param {string} basename - Desired filename base (without .md extension)
 * @param {Set<string>} usedInDir - Set of basenames already assigned in this directory
 * @returns {string} A basename not present in usedInDir
 */
function resolveCollision(basename, usedInDir) {
  if (!usedInDir.has(basename)) {
    return basename;
  }
  let counter = 2;
  while (usedInDir.has(`${basename}-${counter}`)) {
    counter += 1;
  }
  return `${basename}-${counter}`;
}

/**
 * GET /api/notes/:id
 *
 * Returns the full content of a single note.
 *
 * @returns {200} { note: { id, title, body, folder_id, created_at, updated_at } }
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 */
router.get('/:id', ownershipGuard('Note', 'id'), async (req, res, _next) => {
  // ownershipGuard has already verified ownership and attached the Note instance
  // to req.resource. Return it directly — no further service call needed.
  res.json({ note: req.resource });
});

/**
 * PUT /api/notes/:id
 *
 * Updates the title and/or body of a note. This is the auto-save endpoint.
 * Does NOT create a NoteVersion entry (that is POST /api/notes/:id/check-version).
 *
 * Request body:
 *   { title?: string, body?: string, folderId?: string | null }
 *
 * @returns {200} { note: { id, title, body, updated_at } }
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 *
 * Postconditions:
 *   - notes.updated_at is refreshed
 *   - No NoteVersion row is created
 */
router.put('/:id', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    const updates = {};
    if ('title' in req.body) updates.title = req.body.title;
    if ('body' in req.body) updates.body = req.body.body;
    if ('folderId' in req.body) updates.folderId = req.body.folderId;
    const note = await noteService.updateNote(req.params.id, req.session.userId, updates);
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notes/:id
 *
 * Permanently deletes a note and all its versions.
 *
 * @returns {204} (no body)
 * @returns {404} { error: "Not found" } -- note does not exist or belongs to another user
 *
 * Postconditions:
 *   - Note row deleted
 *   - All associated NoteVersion rows deleted (DB CASCADE)
 */
router.delete('/:id', ownershipGuard('Note', 'id'), async (req, res, next) => {
  try {
    await noteService.deleteNote(req.params.id, req.session.userId);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

/**
 * POST /api/notes/:id/tags
 *
 * Adds a tag to a note. Accepts either { tagId } (existing tag) or
 * { name } (inline creation -- creates the tag if it does not exist).
 *
 * @returns {200} { tag: { id, name, created_at } }
 * @returns {404} { error: "Not found" } -- note or tag does not exist or belongs to another user
 * @returns {400} { error: "VALIDATION_ERROR" } -- invalid tag name
 */
router.post('/:id/tags', rateLimiter, async (req, res, next) => {
  try {
    const { tagId, name } = req.body || {};
    const tag = await tagService.addTagToNote(req.params.id, req.session.userId, { tagId, name });
    res.json({ tag });
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

/**
 * DELETE /api/notes/:id/tags/:tagId
 *
 * Removes a tag association from a note.
 *
 * @returns {204} (no body)
 * @returns {404} { error: "Not found" } -- note, tag, or association does not exist
 */
router.delete('/:id/tags/:tagId', async (req, res, next) => {
  try {
    await tagService.removeTagFromNote(req.params.id, req.params.tagId, req.session.userId);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Not found' });
    }
    next(err);
  }
});

module.exports = router;
