/**
 * Unit tests for authenticate middleware (TASK-005).
 *
 * Verifies contract:
 *   - Calls next() when req.session.userId is a non-empty string
 *   - Returns 401 JSON when req.session.userId is absent
 *   - Returns 401 JSON when req.session is undefined
 *   - Never calls next() on rejection
 *
 * These tests are pure unit tests: no database, no HTTP stack.
 * The middleware is tested in isolation via direct function calls.
 *
 * Fitness Functions: FF-D03, FF-D07
 */

'use strict';

const authenticate = require('../../src/middleware/authenticate');

/**
 * Builds a minimal mock req object.
 * @param {object} session - Session data to attach
 * @returns {object}
 */
function mockReq(session) {
  return { session };
}

/**
 * Builds a minimal mock res object that captures status/json calls.
 * status() and json() are jest spies; calling status(code).json(body) chains correctly.
 * @returns {{ status: jest.Mock, json: jest.Mock, _status: number|null, _body: object|null }}
 */
function mockRes() {
  const res = {
    _status: null,
    _body: null,
  };

  res.json = jest.fn((body) => {
    res._body = body;
    return res;
  });

  res.status = jest.fn((code) => {
    res._status = code;
    return res; // enables chaining: res.status(401).json({...})
  });

  return res;
}

describe('authenticate middleware', () => {
  describe('when req.session.userId is a valid UUID string', () => {
    it('calls next() without error', () => {
      const req = mockReq({ userId: 'c0000000-0000-0000-0000-000000000001' });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // called with no arguments (no error)
    });

    it('does not write a response when authenticated', () => {
      const req = mockReq({ userId: 'c0000000-0000-0000-0000-000000000001' });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('when req.session.userId is absent', () => {
    it('returns 401 when session exists but userId is undefined', () => {
      const req = mockReq({});
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when session.userId is null', () => {
      const req = mockReq({ userId: null });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when session.userId is an empty string', () => {
      const req = mockReq({ userId: '' });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('when req.session is absent', () => {
    it('returns 401 when session is undefined', () => {
      const req = mockReq(undefined);
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when session is null', () => {
      const req = { session: null };
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('response shape on rejection', () => {
    it('response body has an "error" key with value "Authentication required"', () => {
      const req = mockReq({});
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res._body).toHaveProperty('error', 'Authentication required');
    });

    it('does not leak session data in the error response', () => {
      const req = mockReq({ userId: undefined, secretData: 'sensitive' });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(JSON.stringify(res._body)).not.toContain('sensitive');
    });
  });
});
