/**
 * Full-text search service.
 *
 * Executes PostgreSQL full-text search against the notes.search_vector column
 * using the GIN index (ADR-005). Search is scoped strictly to the authenticated
 * user's notes (ADR-006). Returns relevance-ranked results with highlighted
 * body snippets.
 *
 * The search_vector column is maintained by the notes_search_vector_update()
 * trigger (title weighted A, body weighted B) -- see ADR-005 and TASK-002.
 */

'use strict';

const { sequelize } = require('../models');

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Sanitizes a raw user-supplied query string into a tsquery-safe format.
 *
 * Algorithm (ADR-005):
 *   1. Split on whitespace
 *   2. Strip each term of any character that is not alphanumeric or hyphen
 *   3. Discard empty terms and terms that consist solely of hyphens (which
 *      are not valid tsquery lexemes and would produce a 500 from PostgreSQL)
 *   4. Join all terms except the last with ' & ' (AND semantics)
 *   5. Append ':*' to the last term for prefix-match (search-as-you-type)
 *
 * Examples:
 *   "postgres index"  -> "postgres & index:*"
 *   "postgres"        -> "postgres:*"
 *   "full-text"       -> "full-text:*"
 *   "hello! world@"   -> "hello & world:*"
 *   "-"               -> throws EMPTY_QUERY (hyphen-only term has no lexeme)
 *
 * @param {string} rawQuery - The raw search string from the user
 * @returns {string} A tsquery-safe sanitized query string
 * @throws {Error} With message 'EMPTY_QUERY' when no terms survive sanitization
 */
function sanitizeQuery(rawQuery) {
  const terms = rawQuery
    .split(/\s+/)
    .map((term) => term.replace(/[^a-zA-Z0-9-]/g, ''))
    .filter((term) => term.length > 0)
    .filter((term) => /[a-zA-Z0-9]/.test(term));

  if (terms.length === 0) {
    throw new Error('EMPTY_QUERY');
  }

  const allButLast = terms.slice(0, -1);
  const last = terms[terms.length - 1];

  if (allButLast.length === 0) {
    return `${last}:*`;
  }

  return `${allButLast.join(' & ')} & ${last}:*`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Searches a user's notes using PostgreSQL full-text search.
 *
 * Query sanitization procedure (ADR-005):
 *   1. Split the raw query on whitespace
 *   2. Remove special characters (anything that is not alphanumeric or hyphen)
 *   3. Filter out empty terms
 *   4. Join all-but-last terms with ' & ' (AND semantics)
 *   5. Append ':*' to the last term for prefix matching (search-as-you-type support)
 *   Example: "postgres index" -> "postgres & index:*"
 *
 * Result ranking uses ts_rank against the weighted search_vector. Title matches
 * (weight A) rank higher than body-only matches (weight B) by PostgreSQL default.
 *
 * @param {string} userId - UUID of the authenticated user
 * @param {string} rawQuery - The raw search string from the user's input
 * @returns {Promise<SearchResult[]>} Relevance-ranked array of matching notes
 *
 * SearchResult shape:
 *   {
 *     id: string,       -- Note UUID
 *     title: string,    -- Full note title
 *     snippet: string,  -- ts_headline fragment with <mark>term</mark> highlights
 *     rank: number,     -- ts_rank score (for ordering, not displayed)
 *   }
 *
 * @throws {Error} With message 'EMPTY_QUERY' if rawQuery is empty after sanitization
 *
 * @precondition userId references a valid user
 * @precondition GIN index on notes.search_vector exists (created by TASK-002 migration)
 * @postcondition Results are ordered by rank DESC (highest relevance first)
 * @postcondition Results contain only notes where user_id = userId
 * @postcondition Empty array returned (not an error) when no notes match the query
 * @postcondition Snippet is generated with ts_headline: StartSel=<mark>, StopSel=</mark>,
 *                MaxFragments=2, MaxWords=30
 */
async function search(userId, rawQuery) {
  const sanitizedQuery = sanitizeQuery(rawQuery);

  const sql = `
    SELECT id, title,
           ts_headline('english', body, query,
                       'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30') AS snippet,
           ts_rank(search_vector, query) AS rank
    FROM notes,
         to_tsquery('english', :sanitized_query) AS query
    WHERE user_id = :user_id
      AND search_vector @@ query
    ORDER BY rank DESC
  `;

  const [rows] = await sequelize.query(sql, {
    replacements: {
      sanitized_query: sanitizedQuery,
      user_id: userId,
    },
  });

  return rows;
}

module.exports = { search };
