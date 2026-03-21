/**
 * Tests for api/tags.js — getTags, createTag, deleteTag, addTagToNote,
 * removeTagFromNote.
 *
 * The fetch global is stubbed for each test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTags,
  createTag,
  deleteTag,
  addTagToNote,
  removeTagFromNote,
} from '../api/tags.js';

describe('tags API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // getTags
  // -------------------------------------------------------------------------

  describe('getTags', () => {
    it('calls GET /api/tags', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tags: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await getTags();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns the tags array in the response', async () => {
      const tags = [{ id: 't1', name: 'research', created_at: '2026-03-21T00:00:00.000Z' }];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tags }),
      }));

      const result = await getTags();

      expect(result).toEqual({ tags });
    });

    it('includes credentials: include in the request', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tags: [] }),
      }));

      await getTags();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({ credentials: 'include' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // createTag
  // -------------------------------------------------------------------------

  describe('createTag', () => {
    it('calls POST /api/tags with the tag name in the body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ tag: { id: 't1', name: 'research', created_at: '2026-03-21T00:00:00.000Z' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await createTag('research');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'research' }),
        })
      );
    });

    it('returns the created tag', async () => {
      const tag = { id: 't1', name: 'research', created_at: '2026-03-21T00:00:00.000Z' };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ tag }),
      }));

      const result = await createTag('research');

      expect(result).toEqual({ tag });
    });
  });

  // -------------------------------------------------------------------------
  // deleteTag
  // -------------------------------------------------------------------------

  describe('deleteTag', () => {
    it('calls DELETE /api/tags/:id', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      });
      vi.stubGlobal('fetch', mockFetch);

      await deleteTag('t1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tags/t1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('returns null on 204 No Content', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      }));

      const result = await deleteTag('t1');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // addTagToNote
  // -------------------------------------------------------------------------

  describe('addTagToNote', () => {
    it('calls POST /api/notes/:noteId/tags with tagId payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tag: { id: 't1', name: 'research' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await addTagToNote('note-1', { tagId: 't1' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes/note-1/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ tagId: 't1' }),
        })
      );
    });

    it('calls POST /api/notes/:noteId/tags with name payload for inline creation', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tag: { id: 't2', name: 'draft' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await addTagToNote('note-1', { name: 'draft' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes/note-1/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'draft' }),
        })
      );
    });

    it('returns the tag from the response', async () => {
      const tag = { id: 't1', name: 'research' };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tag }),
      }));

      const result = await addTagToNote('note-1', { tagId: 't1' });

      expect(result).toEqual({ tag });
    });
  });

  // -------------------------------------------------------------------------
  // removeTagFromNote
  // -------------------------------------------------------------------------

  describe('removeTagFromNote', () => {
    it('calls DELETE /api/notes/:noteId/tags/:tagId', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      });
      vi.stubGlobal('fetch', mockFetch);

      await removeTagFromNote('note-1', 't1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/notes/note-1/tags/t1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('returns null on 204 No Content', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      }));

      const result = await removeTagFromNote('note-1', 't1');

      expect(result).toBeNull();
    });
  });
});
