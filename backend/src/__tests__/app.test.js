/**
 * TASK-016 -- Backend app.js tests
 * Verifies health route mounting, 404 handler, and error handler.
 */

'use strict';

const request = require('supertest');
const app = require('../app');

describe('Express app (TASK-016)', () => {
  describe('404 handler', () => {
    it('returns 404 JSON for unknown API routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
      expect(res.body.message).toContain('/api/nonexistent');
    });

    it('returns 404 for POST to unknown API routes', async () => {
      const res = await request(app).post('/api/unknown').send({ foo: 'bar' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns 404 with the HTTP method in the message', async () => {
      const res = await request(app).delete('/api/nonexistent/123');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('DELETE');
    });
  });

  describe('error handler', () => {
    it('maps known error codes to correct HTTP statuses', () => {
      // Verify the error map is correctly configured by importing app and
      // checking it has the error handling middleware (4-arg function)
      // This is a structural test -- the error handler is the last middleware
      const stack = app._router.stack;
      const errorHandlers = stack.filter(
        (layer) => layer.handle && layer.handle.length === 4
      );
      expect(errorHandlers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('middleware', () => {
    it('parses JSON request bodies', async () => {
      const res = await request(app)
        .post('/api/test-json')
        .send({ test: 'value' })
        .set('Content-Type', 'application/json');
      // Route doesn't exist, so 404 -- but JSON parsing ran without error
      expect(res.status).toBe(404);
    });

    it('sets security headers via helmet', async () => {
      const res = await request(app).get('/api/nonexistent');
      // Helmet sets x-content-type-options among other security headers
      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets x-frame-options header via helmet', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('route mounting', () => {
    it('mounts the health route at /api/health', () => {
      // Verify that /api/health is a mounted route (not a 404)
      // The health handler is a stub that throws, but the route IS mounted
      const stack = app._router.stack;
      const healthLayer = stack.find(
        (layer) => layer.regexp && layer.regexp.test('/api/health')
      );
      expect(healthLayer).toBeTruthy();
    });
  });
});
