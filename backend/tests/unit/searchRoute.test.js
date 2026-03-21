/**
 * Unit tests for GET /api/search route handler (TASK-014).
 *
 * Verifies the route contract:
 *   - Returns 200 with { results: [...] } on a valid query
 *   - Returns 400 with { error: 'EMPTY_QUERY' } when q is missing
 *   - Returns 400 with { error: 'EMPTY_QUERY' } when q is empty string
 *   - Returns 400 with { error: 'EMPTY_QUERY' } when q is whitespace only
 *   - Returns 401 when the request is unauthenticated
 *   - Delegates to searchService.search with session.userId and q
 *
 * searchService is mocked — no database required.
 * authenticate and rlsContext middleware are mocked to isolate route logic.
 */

'use strict';

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../src/services/searchService', () => ({
  search: jest.fn(),
}));

// Default: authenticated as test user
jest.mock('../../src/middleware/authenticate', () =>
  jest.fn((req, res, next) => {
    req.session = { userId: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  })
);

jest.mock('../../src/middleware/rlsContext', () =>
  jest.fn((_req, _res, next) => next())
);

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const searchRouter = require('../../src/routes/search');
const searchService = require('../../src/services/searchService');
const authenticate = require('../../src/middleware/authenticate');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Express app mounting the search router.
 * @returns {express.Application}
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRouter);
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/search', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset authenticate to allow through by default
    authenticate.mockImplementation((req, res, next) => {
      req.session = { userId: USER_ID };
      next();
    });
    app = buildApp();
  });

  it('returns 200 with results array on valid query', async () => {
    const fakeResults = [
      { id: 'note-1', title: 'PostgreSQL Notes', snippet: '<mark>hello</mark>', rank: 0.9 },
    ];
    searchService.search.mockResolvedValue(fakeResults);

    const res = await request(app).get('/api/search?q=hello');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: fakeResults });
    expect(searchService.search).toHaveBeenCalledWith(USER_ID, 'hello');
  });

  it('returns 200 with empty results array when no notes match', async () => {
    searchService.search.mockResolvedValue([]);

    const res = await request(app).get('/api/search?q=nonexistent');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });

  it('returns 400 EMPTY_QUERY when q parameter is missing', async () => {
    const res = await request(app).get('/api/search');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 EMPTY_QUERY when q is an empty string', async () => {
    const res = await request(app).get('/api/search?q=');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 EMPTY_QUERY when q is whitespace only', async () => {
    const res = await request(app).get('/api/search?q=   ');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('returns 400 EMPTY_QUERY when service throws EMPTY_QUERY error', async () => {
    const emptyQueryError = new Error('EMPTY_QUERY');
    searchService.search.mockRejectedValue(emptyQueryError);

    const res = await request(app).get('/api/search?q=!!!');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'EMPTY_QUERY' });
  });

  it('returns 401 when request is unauthenticated', async () => {
    authenticate.mockImplementation((req, res, _next) => {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
    });
    app = buildApp();

    const res = await request(app).get('/api/search?q=hello');

    expect(res.status).toBe(401);
  });

  it('passes next(err) for unexpected service errors', async () => {
    const unexpectedError = new Error('DB_DOWN');
    searchService.search.mockRejectedValue(unexpectedError);

    const res = await request(app).get('/api/search?q=hello');

    expect(res.status).toBe(500);
  });
});
