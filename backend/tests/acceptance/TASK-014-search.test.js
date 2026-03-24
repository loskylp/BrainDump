/**
 * Acceptance Tests — TASK-014: Full-text search across notes
 *
 * REQ-010: Keyword search across all notes
 * ADR-005: PostgreSQL FTS with GIN index
 *
 * These tests exercise the system through the public HTTP interface via
 * supertest and verify the FTS behaviour end-to-end against a live
 * PostgreSQL database. They require POSTGRES_URL to be set and the
 * migrations (including TASK-002 which adds search_vector + GIN index)
 * to have been applied.
 *
 * Acceptance criteria covered:
 *   AC-1  Search input calls GET /api/search?q=:query and returns results
 *   AC-2  Query sanitization produces tsquery-safe format
 *   AC-3  Query uses GIN index (no sequential scan)
 *   AC-4  Note with "PostgreSQL" in title is returned when searching for "PostgreSQL"
 *   AC-5  Note with "PostgreSQL" only in body is returned when searching for "PostgreSQL"
 *   AC-6  Title match ranks higher than body-only match
 *   AC-7  Results include title and snippet with <mark> highlighted terms
 *   AC-8  Search results scoped to authenticated user only
 *   AC-9  Non-existent term returns empty results array (not 404)
 *   AC-10 Search across 200 notes completes in < 200ms
 *
 * Run from the backend directory:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   npx jest --testPathPattern=acceptance/TASK-014 --forceExit
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User, Note } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Registers a new user and returns { cookie, userId }.
 * Registration creates a session automatically (TASK-003 behaviour).
 *
 * @param {object} [overrides]
 * @returns {Promise<{ cookie: string[], userId: string }>}
 */
async function registerUser(overrides = {}) {
  const suffix = Date.now() + Math.random().toString(36).slice(2, 7);
  const defaults = {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: 'password123',
  };
  const data = { ...defaults, ...overrides };

  const res = await request(app).post('/api/auth/register').send(data);
  if (res.status !== 201) {
    throw new Error(`Registration failed for ${data.email}: ${JSON.stringify(res.body)}`);
  }
  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
  };
}

/**
 * Creates a note via the API with the given title and body.
 *
 * @param {string[]} cookie - Session cookie array
 * @param {string} title
 * @param {string} body
 * @returns {Promise<object>} The created note object
 */
async function createNoteViaApi(cookie, title, body = '') {
  const res = await request(app)
    .post('/api/notes')
    .set('Cookie', cookie)
    .send({ title });

  if (res.status !== 201) {
    throw new Error(`Note creation failed: ${JSON.stringify(res.body)}`);
  }

  const noteId = res.body.note.id;

  // Update body separately (createNote only accepts title)
  if (body) {
    await request(app)
      .put(`/api/notes/${noteId}`)
      .set('Cookie', cookie)
      .send({ title, body });
  }

  return res.body.note;
}

// ---------------------------------------------------------------------------
// Suite setup and teardown
// ---------------------------------------------------------------------------

// Each test creates its own users and notes — no global state between tests.
// afterAll closes the DB connection to allow the process to exit cleanly.

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

describe('TASK-014: Full-text search (AC-1 to AC-10)', () => {
  it('AC-1: GET /api/search?q=:query returns 200 with results array', async () => {
    const { cookie } = await registerUser();
    await createNoteViaApi(cookie, 'PostgreSQL Basics', 'Introduction to PostgreSQL.');

    const res = await request(app)
      .get('/api/search?q=PostgreSQL')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  it('AC-2: Service sanitizes query into tsquery-safe format (multi-term)', async () => {
    // This is covered by the unit tests (searchService.test.js).
    // At the acceptance level, we verify the endpoint handles a multi-word
    // query without erroring.
    const { cookie } = await registerUser();
    await createNoteViaApi(cookie, 'full text search', 'Full text search is useful.');

    const res = await request(app)
      .get('/api/search?q=full+text')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('AC-3: Query uses search_vector column (GIN index path, no error on EXPLAIN)', async () => {
    const { cookie, userId } = await registerUser();
    await createNoteViaApi(cookie, 'Index test note', 'PostgreSQL GIN index.');

    // EXPLAIN the query to verify the GIN index is usable.
    // On small tables PostgreSQL's planner may choose a sequential scan because
    // it is cheaper than an index lookup.  Temporarily disable sequential scans
    // so the planner is forced to use the index if it exists, which is what this
    // acceptance criterion actually verifies.
    const sanitizedQuery = 'index:*';
    const [explainRows] = await sequelize.query(
      `SET LOCAL enable_seqscan = OFF;
       EXPLAIN SELECT id FROM notes,
         to_tsquery('english', :q) AS query
       WHERE user_id = :userId AND search_vector @@ query`,
      { replacements: { q: sanitizedQuery, userId } }
    );

    const explainText = explainRows.map((r) => Object.values(r).join(' ')).join('\n');
    expect(explainText).toMatch(/Index Scan|Bitmap Index Scan|idx_notes_search/i);
  });

  it('AC-4: Note with term in title is returned when searching for that term', async () => {
    const { cookie } = await registerUser();
    await createNoteViaApi(cookie, 'PostgreSQL Advanced Guide', '');

    const res = await request(app)
      .get('/api/search?q=PostgreSQL')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const titles = res.body.results.map((r) => r.title);
    expect(titles).toContain('PostgreSQL Advanced Guide');
  });

  it('AC-5: Note with term only in body is returned when searching for that term', async () => {
    const { cookie } = await registerUser();
    await createNoteViaApi(
      cookie,
      'Untitled Note',
      'This note is about PostgreSQL internals.'
    );

    const res = await request(app)
      .get('/api/search?q=PostgreSQL')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  it('AC-6: Title match ranks higher than body-only match', async () => {
    const { cookie } = await registerUser();

    await createNoteViaApi(cookie, 'PostgreSQL Title Note', 'General database content.');
    await createNoteViaApi(cookie, 'General Note', 'PostgreSQL is mentioned in the body only.');

    const res = await request(app)
      .get('/api/search?q=PostgreSQL')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.results.length).toBeGreaterThanOrEqual(2);

    // Title match should appear first (higher rank)
    expect(res.body.results[0].title).toBe('PostgreSQL Title Note');
  });

  it('AC-7: Results include title and snippet with <mark> highlighted terms', async () => {
    const { cookie } = await registerUser();
    await createNoteViaApi(
      cookie,
      'PostgreSQL Snippets',
      'PostgreSQL full-text search highlights matching terms.'
    );

    const res = await request(app)
      .get('/api/search?q=PostgreSQL')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const result = res.body.results.find((r) => r.title === 'PostgreSQL Snippets');
    expect(result).toBeDefined();
    expect(result.snippet).toContain('<mark>');
    expect(result.snippet).toContain('</mark>');
  });

  it('AC-8: Search results are scoped to the authenticated user only', async () => {
    const { cookie: cookieA } = await registerUser();
    const { cookie: cookieB } = await registerUser();

    // User A creates a note with a unique term
    const uniqueTerm = `uniqueterm${Date.now()}`;
    await createNoteViaApi(cookieA, `${uniqueTerm} in title`, '');

    // User B searches — should get no results for userA's term
    const res = await request(app)
      .get(`/api/search?q=${uniqueTerm}`)
      .set('Cookie', cookieB);

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });

  it('AC-9: Non-existent term returns empty results array (not 404)', async () => {
    const { cookie } = await registerUser();

    const res = await request(app)
      .get('/api/search?q=xyznonexistentterm999zzz')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('AC-10: Search across 200 notes completes in < 200ms', async () => {
    const { cookie, userId } = await registerUser();

    // Seed 200 notes directly via the model for speed
    const notes = Array.from({ length: 200 }, (_, i) => ({
      id: require('uuid').v4(),
      title: `Performance test note ${i}`,
      body: `This note contains the word searchterm and index ${i}.`,
      user_id: userId,
      folder_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    await Note.bulkCreate(notes);

    // Force search_vector to be populated via UPDATE (trigger fires on update)
    await sequelize.query(
      `UPDATE notes SET updated_at = NOW() WHERE user_id = :userId`,
      { replacements: { userId } }
    );

    const start = Date.now();
    const res = await request(app)
      .get('/api/search?q=searchterm')
      .set('Cookie', cookie);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(200);
  }, 10000);

  it('returns 400 EMPTY_QUERY when q parameter is missing', async () => {
    const { cookie } = await registerUser();

    const res = await request(app)
      .get('/api/search')
      .set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
  });

  it('returns 401 when request is unauthenticated', async () => {
    const res = await request(app).get('/api/search?q=hello');

    expect(res.status).toBe(401);
  });
});
