/**
 * Unit tests for searchService.search (TASK-014).
 *
 * Verifies the contract:
 *   - Sanitization: multi-term input produces correct tsquery format
 *   - Sanitization: single term produces "term:*"
 *   - Sanitization: special characters are stripped
 *   - Sanitization: empty/whitespace-only input throws EMPTY_QUERY
 *   - Sanitization: all-special-character input throws EMPTY_QUERY
 *   - Sanitization: hyphenated terms are preserved
 *   - FTS query returns results in the expected shape
 *   - Results are scoped to the requesting user (ownership isolation)
 *
 * All database calls are mocked — no database required.
 */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../../src/models', () => ({
  sequelize: {
    query: mockQuery,
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { search } = require('../../src/services/searchService');

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('searchService.search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Sanitization tests (these test internal behaviour via public interface)
  // -------------------------------------------------------------------------

  describe('query sanitization', () => {
    it('produces "term:*" for a single term', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'postgres');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.sanitized_query).toBe('postgres:*');
    });

    it('produces "first & last:*" for a two-term query', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'postgres index');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.sanitized_query).toBe('postgres & index:*');
    });

    it('produces "&"-joined terms with last term having ":*"', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'full text search');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.sanitized_query).toBe('full & text & search:*');
    });

    it('strips special characters from each term', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'hello! world@');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.sanitized_query).toBe('hello & world:*');
    });

    it('preserves hyphens within terms', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'full-text');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.sanitized_query).toBe('full-text:*');
    });

    it('throws EMPTY_QUERY when input is an empty string', async () => {
      await expect(search(USER_ID, '')).rejects.toThrow('EMPTY_QUERY');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('throws EMPTY_QUERY when input is whitespace only', async () => {
      await expect(search(USER_ID, '   ')).rejects.toThrow('EMPTY_QUERY');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('throws EMPTY_QUERY when all terms consist only of special characters', async () => {
      await expect(search(USER_ID, '!!! @@@')).rejects.toThrow('EMPTY_QUERY');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('throws EMPTY_QUERY when input is a lone hyphen', async () => {
      await expect(search(USER_ID, '-')).rejects.toThrow('EMPTY_QUERY');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('throws EMPTY_QUERY when input consists only of hyphens and whitespace', async () => {
      await expect(search(USER_ID, '- --')).rejects.toThrow('EMPTY_QUERY');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('trims leading and trailing whitespace before processing', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, '  notes  ');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.sanitized_query).toBe('notes:*');
    });
  });

  // -------------------------------------------------------------------------
  // SQL execution and result mapping
  // -------------------------------------------------------------------------

  describe('FTS execution', () => {
    it('passes userId as a bound parameter in the SQL query', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'markdown');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.user_id).toBe(USER_ID);
    });

    it('returns an array of results with id, title, snippet, and rank', async () => {
      const fakeRows = [
        {
          id: 'note-1',
          title: 'PostgreSQL Notes',
          snippet: '<mark>PostgreSQL</mark> is a great database',
          rank: 0.9,
        },
        {
          id: 'note-2',
          title: 'Untitled',
          snippet: 'I use <mark>PostgreSQL</mark> daily',
          rank: 0.3,
        },
      ];
      mockQuery.mockResolvedValue([fakeRows]);

      const results = await search(USER_ID, 'PostgreSQL');

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        id: 'note-1',
        title: 'PostgreSQL Notes',
        snippet: '<mark>PostgreSQL</mark> is a great database',
        rank: 0.9,
      });
    });

    it('returns an empty array when no notes match', async () => {
      mockQuery.mockResolvedValue([[]]);

      const results = await search(USER_ID, 'nonexistentterm');

      expect(results).toEqual([]);
    });

    it('scopes query to the requesting user via user_id replacement', async () => {
      // The ownership isolation is enforced by passing userId to the SQL,
      // which applies a WHERE user_id = :user_id filter. We verify the
      // correct userId is passed, not the other user's.
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'shared topic');

      const [sql, opts] = mockQuery.mock.calls[0];
      expect(opts.replacements.user_id).toBe(USER_ID);
      expect(opts.replacements.user_id).not.toBe(OTHER_USER_ID);
    });

    it('uses to_tsquery in the SQL statement', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'query');

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('to_tsquery');
    });

    it('uses search_vector @@ query in the WHERE clause', async () => {
      mockQuery.mockResolvedValue([[]]);

      await search(USER_ID, 'vector');

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('search_vector');
    });
  });
});
