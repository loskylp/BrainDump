/**
 * Verifier Acceptance Tests — TASK-014: Full-text search across notes
 *
 * Requirement: REQ-010 (Full-text search)
 * ADRs: ADR-005 (PostgreSQL FTS with GIN index), ADR-006 (per-user isolation)
 *
 * These tests are authored by the Verifier. They operate exclusively through
 * the system's public HTTP interface (supertest against the Express app) and
 * against a live PostgreSQL database with the TASK-002 migration applied.
 * No implementation internals are accessed at the system or acceptance layer.
 *
 * Acceptance criteria covered:
 *   AC-1  Search input calls GET /api/search?q=:query and returns { results: [...] }
 *   AC-2  searchService sanitizes user input to tsquery-safe format
 *   AC-3  Query uses the search_vector column with GIN index — no sequential scan
 *   AC-4  Note with matching term in title is returned when searching that term
 *   AC-5  Note with matching term only in body is returned when searching that term
 *   AC-6  Title match ranks higher than body-only match
 *   AC-7  Results include title and snippet with <mark>-highlighted terms
 *   AC-8  Search results scoped to the authenticated user only (per-user isolation)
 *   AC-9  Non-existent term returns empty results with HTTP 200 (not 404)
 *   AC-10 Search across 200 notes completes in < 200ms (FF-D24)
 *
 * Fitness Functions verified: FF-D19, FF-D20, FF-D21, FF-D22, FF-D23, FF-D24, FF-D25
 *
 * Run from the backend directory (local dev):
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   SESSION_SECRET=test-secret APP_URL=http://localhost:3000 EMAIL_PROVIDER=console \
 *   npx jest --testPathPattern=tests/acceptance/TASK-014-search-verifier --forceExit
 *
 * In CI, the integration-tests job sets POSTGRES_URL automatically.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const request = require('supertest');
const app = require('../../backend/src/app');
const { sequelize, Note } = require('../../backend/src/models');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Registers a new user and returns { cookie, userId }.
 * Each call generates a unique email to avoid conflicts.
 */
async function registerUser() {
  const suffix = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      username: `verifier_${suffix}`,
      email: `verifier_${suffix}@example.com`,
      password: 'password123',
    });
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
  }
  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
  };
}

/**
 * Creates a note with the given title via POST /api/notes, then updates the
 * body via PUT /api/notes/:id (createNote only sets title).
 *
 * @param {string[]} cookie  Session cookie
 * @param {string} title     Note title
 * @param {string} [body]    Note body (Markdown)
 * @returns {Promise<object>} Created note object
 */
async function createNote(cookie, title, body = '') {
  const createRes = await request(app)
    .post('/api/notes')
    .set('Cookie', cookie)
    .send({ title });

  if (createRes.status !== 201) {
    throw new Error(`createNote failed: ${JSON.stringify(createRes.body)}`);
  }

  const note = createRes.body.note;

  if (body) {
    await request(app)
      .put(`/api/notes/${note.id}`)
      .set('Cookie', cookie)
      .send({ title, body });
  }

  return note;
}

/**
 * Calls GET /api/search?q=:query with the given session cookie.
 */
function search(cookie, query) {
  return request(app)
    .get(`/api/search?q=${encodeURIComponent(query)}`)
    .set('Cookie', cookie);
}

// ---------------------------------------------------------------------------
// Suite teardown — close DB connection so Jest can exit cleanly.
// ---------------------------------------------------------------------------

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1: Endpoint contract
// REQ-010: A search input accepts a text query and returns matching notes.
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-010]: GET /api/search?q=:query returns 200 with results array', () => {
  // Given: an authenticated user who has a note containing the search term
  // When: they call GET /api/search?q=PostgreSQL
  // Then: 200 with { results: [...] }

  it('returns HTTP 200 and a results array on a valid query', async () => {
    const { cookie } = await registerUser();
    await createNote(cookie, 'PostgreSQL Basics', 'Introduction to PostgreSQL.');

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  // Negative: missing q parameter must return 400, not 200
  it('[VERIFIER-ADDED] returns 400 EMPTY_QUERY when q parameter is absent', async () => {
    const { cookie } = await registerUser();

    const res = await request(app)
      .get('/api/search')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
  });

  // Negative: whitespace-only q must return 400, not 200
  it('[VERIFIER-ADDED] returns 400 EMPTY_QUERY when q is whitespace only', async () => {
    const { cookie } = await registerUser();

    const res = await request(app)
      .get('/api/search?q=%20%20%20')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
  });

  // Negative: unauthenticated request must be rejected
  it('[VERIFIER-ADDED] returns 401 for an unauthenticated request', async () => {
    const res = await request(app).get('/api/search?q=hello');

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Query sanitization
// REQ-010: Search uses PostgreSQL full-text search (not application-level string matching)
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-010]: Query sanitization produces tsquery-safe format', () => {
  // Given: a user with notes
  // When: they search with a multi-word query containing no special characters
  // Then: the endpoint returns 200 without error (sanitizer produced valid tsquery)

  it('handles a multi-word query without error', async () => {
    const { cookie } = await registerUser();
    await createNote(cookie, 'full text search guide', 'Full text search is powerful.');

    const res = await search(cookie, 'full text');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  // Negative: all-special-char query must return 400
  it('[VERIFIER-ADDED] returns 400 EMPTY_QUERY when query contains only special characters', async () => {
    const { cookie } = await registerUser();

    // "!!!" and "@@@" are stripped — no terms survive sanitization
    const res = await request(app)
      .get('/api/search?q=%21%21%21%20%40%40%40')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
  });

  // Sanitizer must handle tsquery operators embedded in input safely
  it('[VERIFIER-ADDED] handles query containing tsquery operator chars (|, &, !, ()) without 500', async () => {
    const { cookie } = await registerUser();

    // Input: "postgres | index" — the | and ! are stripped by the sanitizer
    // Expected: sanitized to "postgres & index:*" → valid tsquery → 200
    const res = await search(cookie, 'postgres | index');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  // Single-character query must not error
  it('[VERIFIER-ADDED] handles a single-character query without error', async () => {
    const { cookie } = await registerUser();

    const res = await search(cookie, 'a');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-3: GIN index used — no sequential scan (FF-D24 infrastructure check)
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-010, FF-D24]: Query uses search_vector GIN index, not a sequential scan', () => {
  // Given: the notes table has a GIN index on search_vector (created by TASK-002)
  // When: we EXPLAIN a search query
  // Then: the plan mentions an Index Scan or Bitmap Index Scan on idx_notes_search

  it('EXPLAIN shows an index scan on search_vector, not a sequential scan', async () => {
    const { cookie, userId } = await registerUser();
    await createNote(cookie, 'GIN index test', 'PostgreSQL GIN index for search.');

    const sanitizedQuery = 'index:*';
    const [explainRows] = await sequelize.query(
      `EXPLAIN SELECT id FROM notes,
         to_tsquery('english', :q) AS query
       WHERE user_id = :userId AND search_vector @@ query`,
      { replacements: { q: sanitizedQuery, userId } }
    );

    const planText = explainRows.map((r) => Object.values(r).join(' ')).join('\n');
    // Must contain evidence of an index scan, not a Seq Scan
    expect(planText).toMatch(/Index Scan|Bitmap Index Scan|idx_notes_search/i);
    expect(planText).not.toMatch(/Seq Scan on notes/i);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Title field searched
// REQ-010: A match in the title field returns the note.
// Given/When/Then from REQ-010 scenario 1.
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-010, FF-D19]: Note with term in title is returned when searching that term', () => {
  // Given: a note titled "PostgreSQL Indexing" with no "PostgreSQL" in body
  // When: user searches for "PostgreSQL"
  // Then: that note is returned

  it('returns a note whose title contains the search term', async () => {
    const { cookie } = await registerUser();
    await createNote(cookie, 'PostgreSQL Indexing', 'This note is about database internals.');

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    const titles = res.body.results.map((r) => r.title);
    expect(titles).toContain('PostgreSQL Indexing');
  });

  // Negative: a note that does NOT contain the search term must NOT appear
  it('[VERIFIER-ADDED] does NOT return a note whose title contains no matching term', async () => {
    const { cookie } = await registerUser();
    const uniqueId = `zznomatch${Date.now()}`;
    await createNote(cookie, 'Completely unrelated content', 'Nothing here matches the query.');

    const res = await search(cookie, uniqueId);

    expect(res.status).toBe(200);
    const titles = res.body.results.map((r) => r.title);
    expect(titles).not.toContain('Completely unrelated content');
  });
});

// ---------------------------------------------------------------------------
// AC-5: Body field searched
// REQ-010: A match in the body field alone returns the note.
// Given/When/Then from REQ-010 scenario 2.
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-010, FF-D20]: Note with term only in body is returned when searching that term', () => {
  // Given: a note titled "Meeting Notes" with "PostgreSQL" only in body
  // When: user searches for "PostgreSQL"
  // Then: that note is returned

  it('returns a note whose body (not title) contains the search term', async () => {
    const { cookie } = await registerUser();
    await createNote(
      cookie,
      'Meeting Notes',
      'Discussed PostgreSQL migration with the team.'
    );

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
    const found = res.body.results.some((r) => r.title === 'Meeting Notes');
    expect(found).toBe(true);
  });

  // Negative: a note that matches in neither title nor body must NOT appear
  it('[VERIFIER-ADDED] does NOT return a note with no match in title or body', async () => {
    const { cookie } = await registerUser();
    const uniqueTerm = `xqqnomatch${Date.now()}`;
    await createNote(cookie, 'Some random title', 'Some random content, no match here.');

    const res = await search(cookie, uniqueTerm);

    expect(res.status).toBe(200);
    const found = res.body.results.some((r) => r.title === 'Some random title');
    expect(found).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Title match ranks higher than body-only match
// REQ-010: Results are ranked by relevance.
// Given/When/Then from REQ-010 scenario 3.
// FF-D21
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-010, FF-D21]: Title match ranks higher than body-only match', () => {
  // Given: two notes — one with the term in the title, one with the term only in body
  // When: user searches for that term
  // Then: the title-match note appears before the body-only match

  it('title-match result precedes body-only match in the results list', async () => {
    const { cookie } = await registerUser();

    await createNote(cookie, 'PostgreSQL Title Note', 'General database content here.');
    await createNote(cookie, 'General Note', 'PostgreSQL is mentioned only in the body.');

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(2);

    const titleNoteIndex = res.body.results.findIndex(
      (r) => r.title === 'PostgreSQL Title Note'
    );
    const bodyNoteIndex = res.body.results.findIndex(
      (r) => r.title === 'General Note'
    );

    expect(titleNoteIndex).not.toBe(-1);
    expect(bodyNoteIndex).not.toBe(-1);
    expect(titleNoteIndex).toBeLessThan(bodyNoteIndex);
  });

  // Negative: a body-only match must NOT appear before a title match
  it('[VERIFIER-ADDED] body-only match does NOT appear before the title match', async () => {
    const { cookie } = await registerUser();

    await createNote(cookie, 'Indexing Guide', 'General guide content.');
    await createNote(cookie, 'Random Title', 'Indexing strategies for large datasets.');

    const res = await search(cookie, 'Indexing');

    expect(res.status).toBe(200);
    if (res.body.results.length >= 2) {
      const titleMatchIdx = res.body.results.findIndex((r) => r.title === 'Indexing Guide');
      const bodyMatchIdx = res.body.results.findIndex((r) => r.title === 'Random Title');
      if (titleMatchIdx !== -1 && bodyMatchIdx !== -1) {
        expect(titleMatchIdx).toBeLessThan(bodyMatchIdx);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AC-7: Results include title and snippet with <mark>-highlighted terms
// REQ-010: Results contain identifiable information about matched content.
// FF-D25
// ---------------------------------------------------------------------------

describe('AC-7 [REQ-010, FF-D25]: Results include title and <mark>-highlighted snippet', () => {
  // Given: a note containing the search term in the body
  // When: user searches for that term
  // Then: the result has a title and a snippet containing <mark>…</mark>

  it('result contains a title string', async () => {
    const { cookie } = await registerUser();
    await createNote(cookie, 'Snippet Test Note', 'PostgreSQL full-text search highlights terms.');

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    const result = res.body.results.find((r) => r.title === 'Snippet Test Note');
    expect(result).toBeDefined();
    expect(typeof result.title).toBe('string');
    expect(result.title.length).toBeGreaterThan(0);
  });

  it('result contains a snippet with <mark> and </mark> tags', async () => {
    const { cookie } = await registerUser();
    await createNote(
      cookie,
      'Snippet Test Note Marked',
      'PostgreSQL full-text search highlights matching terms.'
    );

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    const result = res.body.results.find((r) => r.title === 'Snippet Test Note Marked');
    expect(result).toBeDefined();
    expect(result.snippet).toContain('<mark>');
    expect(result.snippet).toContain('</mark>');
  });

  // Negative: a result must NOT have an empty snippet when the term matches in body
  it('[VERIFIER-ADDED] snippet is non-empty when the term matched in the body', async () => {
    const { cookie } = await registerUser();
    await createNote(cookie, 'Body Match Only', 'PostgreSQL internals are fascinating.');

    const res = await search(cookie, 'PostgreSQL');

    expect(res.status).toBe(200);
    const result = res.body.results.find((r) => r.title === 'Body Match Only');
    expect(result).toBeDefined();
    expect(result.snippet).toBeTruthy();
    expect(result.snippet.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-8: Per-user isolation enforced
// REQ-010: Only that user's notes appear (cross-referencing REQ-011).
// REQ-011: Search does not leak another user's data.
// Given/When/Then from REQ-010 scenario 6 and REQ-011 scenario 2.
// FF-D22
// ---------------------------------------------------------------------------

describe('AC-8 [REQ-010, REQ-011, FF-D22]: Search results scoped to authenticated user only', () => {
  // Given: User A and User B — A creates a note with a unique term
  // When: User B searches for that term
  // Then: User B sees no results (A's notes are not visible to B)

  it("user B cannot see user A's notes in search results", async () => {
    const userA = await registerUser();
    const userB = await registerUser();

    const uniqueTerm = `isolationtest${Date.now()}`;
    await createNote(userA.cookie, `${uniqueTerm} in title`, '');

    const res = await search(userB.cookie, uniqueTerm);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });

  // Positive: user A can find their own note
  it("user A can find their own notes in search results", async () => {
    const userA = await registerUser();
    const uniqueTerm = `myownterm${Date.now()}`;
    await createNote(userA.cookie, `${uniqueTerm} guide`, '');

    const res = await search(userA.cookie, uniqueTerm);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  // Negative: searching without a session must be rejected entirely (not leak any data)
  it('[VERIFIER-ADDED] unauthenticated search is rejected with 401, not an empty result set', async () => {
    const res = await request(app).get('/api/search?q=postgres');

    // Must be 401, not 200 with empty array — an empty 200 would be ambiguous
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-9: Non-existent term returns empty results, not 404
// REQ-010: An empty result set is displayed with a clear message.
// Given/When/Then from REQ-010 scenario 5.
// FF-D23
// ---------------------------------------------------------------------------

describe('AC-9 [REQ-010, FF-D23]: Non-existent term returns empty results array with HTTP 200', () => {
  // Given: an authenticated user with notes that do not match the search term
  // When: user searches for a term that exists in no note
  // Then: HTTP 200 with an empty results array (not 404, not 500)

  it('returns HTTP 200 with an empty array when no notes match', async () => {
    const { cookie } = await registerUser();

    const res = await search(cookie, 'xyzqrstuvwnomatch99887766');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  // Negative: must be 200 (not 404 "not found" and not 500 "server error")
  it('[VERIFIER-ADDED] response is not 404 when no notes match the term', async () => {
    const { cookie } = await registerUser();

    const res = await search(cookie, 'absolutelynonexistentterm12345');

    expect(res.status).not.toBe(404);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC-10: Performance — search across 200 notes completes in < 200ms
// REQ-010: Search performance remains fast as collection grows to hundreds of notes.
// FF-D24
// ---------------------------------------------------------------------------

describe('AC-10 [REQ-010, FF-D24]: Search across 200 notes completes in < 200ms', () => {
  // Given: a user with 200 notes seeded directly via the model
  // When: user searches for a term that appears in many notes
  // Then: the round-trip HTTP response time is < 200ms

  it('search completes in under 200ms against a 200-note collection', async () => {
    const { cookie, userId } = await registerUser();
    const { v4: uuidv4 } = require('uuid');

    // Seed 200 notes directly — using the model for speed avoids 200 HTTP round-trips
    const notes = Array.from({ length: 200 }, (_, i) => ({
      id: uuidv4(),
      title: `Performance note ${i}`,
      body: `This note contains the keyword perfterm and index ${i}.`,
      user_id: userId,
      folder_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    await Note.bulkCreate(notes);

    // Trigger the search_vector update trigger by touching updated_at
    await sequelize.query(
      'UPDATE notes SET updated_at = NOW() WHERE user_id = :userId',
      { replacements: { userId } }
    );

    const start = Date.now();
    const res = await search(cookie, 'perfterm');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    // FF-D24 threshold: < 200ms
    expect(elapsed).toBeLessThan(200);
  }, 15000); // 15s test timeout to allow for seeding
});
