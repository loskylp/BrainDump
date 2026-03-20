/**
 * TASK-008 -- Tests for api/notes.js getNotes and createNote functions.
 *
 * Verifies:
 *   - getNotes() calls GET /api/notes and returns the notes array
 *   - createNote() calls POST /api/notes and returns the created note
 *
 * The fetch global is stubbed for each test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNotes, createNote, getNote } from '../api/notes.js';

describe('notes API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // getNotes
  // -------------------------------------------------------------------------

  describe('getNotes', () => {
    it('calls GET /api/notes', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ notes: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await getNotes();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns the full response object including notes array', async () => {
      const notes = [
        { id: '1', title: 'Note A', updated_at: '2026-03-20T10:00:00.000Z', folder_id: null },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ notes }),
      }));

      const result = await getNotes();

      expect(result).toEqual({ notes });
    });

    it('includes credentials: include in the request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ notes: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await getNotes();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // createNote
  // -------------------------------------------------------------------------

  describe('createNote', () => {
    it('calls POST /api/notes with the provided title', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ note: { id: '1', title: 'New Note', body: '' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await createNote({ title: 'New Note' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'New Note', folderId: undefined }),
        })
      );
    });

    it('returns the full response object including the created note', async () => {
      const note = { id: '1', title: 'New Note', body: '', folder_id: null };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ note }),
      }));

      const result = await createNote({ title: 'New Note' });

      expect(result).toEqual({ note });
    });

    it('defaults title to empty string when not provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ note: { id: '1', title: '', body: '' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await createNote();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({
          body: JSON.stringify({ title: '', folderId: undefined }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // getNote (TASK-008 iter-2)
  // -------------------------------------------------------------------------

  describe('getNote', () => {
    it('calls GET /api/notes/:noteId with the given id', async () => {
      const noteId = 'dddddddd-0000-0000-0000-000000000003';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ note: { id: noteId, title: 'A Note', body: 'Content' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await getNote(noteId);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/notes/${noteId}`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns the full response object including the note', async () => {
      const noteId = 'dddddddd-0000-0000-0000-000000000003';
      const note = { id: noteId, title: 'A Note', body: 'Hello', folder_id: null };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ note }),
      }));

      const result = await getNote(noteId);

      expect(result).toEqual({ note });
    });

    it('includes credentials: include in the request', async () => {
      const noteId = 'dddddddd-0000-0000-0000-000000000003';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ note: { id: noteId, title: '', body: '' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await getNote(noteId);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/notes/${noteId}`,
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });
});
