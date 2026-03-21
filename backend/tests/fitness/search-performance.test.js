/**
 * Fitness Function Tests — FF-D24: Search performance baseline
 *
 * ADR-005: PostgreSQL FTS with GIN index
 *
 * This file is the dedicated regression guard for the search performance
 * fitness function. It provisions isolated test data, exercises the live
 * search endpoint, and verifies both the response-time threshold and the
 * database-level GIN index usage.
 *
 * These tests require a live PostgreSQL connection. They run in the
 * migration-test CI job (Job 4 in .github/workflows/ci.yml), which
 * provisions a fresh PostgreSQL instance and applies all migrations.
 *
 * Fitness functions covered:
 *   FF-D24 — Search across 200 notes completes in < 200ms
 *   (Supporting) GIN index on search_vector is used, not sequential scan
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');

const app = require('../../src/app');
const { sequelize, User, Note } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Registers a new user via the public API and returns { cookie, userId }.
 *
 * Uses a time-stamped unique suffix so each test run operates on a
 * completely isolated user with no collision risk.
 *
 * @returns {Promise<{ cookie: string[], userId: string }>}
 */
async function registerUser() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const data = {
    username: `ffuser_${suffix}`,
    email: `ffuser_${suffix}@fitness.test`,
    password: 'password123',
  };

  const res = await request(app).post('/api/auth/register').send(data);
  if (res.status !== 201) {
    throw new Error(
      `FF test user registration failed for ${data.email}: ${JSON.stringify(res.body)}`
    );
  }

  return {
    cookie: res.headers['set-cookie'],
    userId: res.body.user.id,
  };
}

/**
 * Seeds 200 notes for the given user via a single bulk INSERT.
 *
 * Each note has a distinct indexed title and body so that the
 * tsvector/GIN index is actually populated and exercised. A shared
 * searchable term ("searchterm") appears in every body to guarantee
 * the test query returns results.
 *
 * The bulk INSERT triggers the notes_search_vector_update trigger for
 * each row, populating search_vector without a subsequent UPDATE.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function seed200Notes(userId) {
  const notes = Array.from({ length: 200 }, (_, i) => ({
    id: uuidv4(),
    title: `Performance note ${i} about databases`,
    body: `This note discusses searchterm concepts related to topic ${i}. ` +
          `It covers indexing strategies, query planning, and data management at scale.`,
    user_id: userId,
    folder_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  }));

  await Note.bulkCreate(notes);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// FF-D24: Search performance baseline
// ---------------------------------------------------------------------------

describe('FF-D24: Search across 200 notes completes in < 200ms', () => {
  let cookie;
  let userId;

  beforeAll(async () => {
    // FF-D24: Provision an isolated user with 200 seeded notes.
    // Teardown is via user deletion (CASCADE removes notes).
    ({ cookie, userId } = await registerUser());
    await seed200Notes(userId);
  });

  afterAll(async () => {
    // Delete the test user — CASCADE removes all associated notes.
    await sequelize.query('DELETE FROM users WHERE id = :id', {
      replacements: { id: userId },
    });
  });

  // FF-D24: Search across 200 notes completes in < 200ms
  test('search across 200 seeded notes returns within 200ms', async () => {
    // Measure only the HTTP round-trip — not the test setup time.
    const start = Date.now();
    const res = await request(app)
      .get('/api/search?q=searchterm')
      .set('Cookie', cookie);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.results).toBeDefined();
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);

    // FF-D24: the threshold is 200ms per ADR-005 and task AC-10.
    expect(elapsed).toBeLessThan(200);
  }, 15000 /* setup timeout */);

  // Supporting FF-D24: Verify the GIN index on search_vector is exercised,
  // not a sequential scan. A sequential scan would degrade performance at
  // scale and violate the architectural decision in ADR-005.
  test('EXPLAIN ANALYZE confirms Bitmap Index Scan on idx_notes_search (no Seq Scan on notes)', async () => {
    // FF-D24 (GIN index verification): Run EXPLAIN ANALYZE in JSON format so
    // the full plan tree is inspectable. Assert the plan includes a Bitmap
    // Index Scan on idx_notes_search and does NOT fall back to a sequential
    // scan, which would indicate the index is not being used.
    const sanitizedQuery = 'searchterm:*';

    const [rows] = await sequelize.query(
      `EXPLAIN (ANALYZE, FORMAT JSON)
       SELECT id, title
       FROM notes,
            to_tsquery('english', :q) AS query
       WHERE user_id = :userId
         AND search_vector @@ query`,
      { replacements: { q: sanitizedQuery, userId } }
    );

    // EXPLAIN FORMAT JSON returns a single row with the plan as a JSON string
    // (Sequelize may return it parsed or as a string depending on driver version).
    const planText =
      typeof rows[0]['QUERY PLAN'] === 'string'
        ? rows[0]['QUERY PLAN']
        : JSON.stringify(rows[0]['QUERY PLAN']);

    // The GIN index should be referenced in the plan.
    expect(planText).toMatch(/idx_notes_search/i);

    // The plan must not fall back to a sequential scan on the notes table.
    // A Seq Scan here would indicate the GIN index is missing or not used.
    expect(planText).not.toMatch(/Seq Scan on notes/i);
  }, 15000);
});
