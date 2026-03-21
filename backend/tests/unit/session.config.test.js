/**
 * Unit tests for backend/src/config/session.js — SEC-004 startup guard.
 *
 * Verifies that the module throws when SESSION_SECRET is absent in
 * non-test environments, and does NOT throw in test environments even
 * when the secret is absent.
 *
 * The module is loaded fresh for each test using jest.isolateModules()
 * so that the guard runs again without the previous module cache.
 *
 * Mocks: connect-pg-simple and express-session are stubbed so no real
 * PostgreSQL connection is required.
 */

'use strict';

// Stub out express-session and connect-pg-simple so session.js can be
// imported without requiring a real database or network connection.
jest.mock('express-session', () => {
  const middleware = jest.fn(() => jest.fn());
  middleware.Store = class {};
  return middleware;
});

jest.mock('connect-pg-simple', () => {
  return () => class PgStore {};
});

jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('session.js — SEC-004 SESSION_SECRET startup guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Work on a copy so mutations do not bleed between tests
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('in a non-test environment (NODE_ENV=production)', () => {
    it('throws when SESSION_SECRET is not set', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SESSION_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          require('../../src/config/session');
        });
      }).toThrow('SESSION_SECRET environment variable is required in non-test environments');
    });

    it('does not throw when SESSION_SECRET is set', () => {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'a-very-secret-key';

      expect(() => {
        jest.isolateModules(() => {
          require('../../src/config/session');
        });
      }).not.toThrow();
    });
  });

  describe('in a non-test environment (NODE_ENV=development)', () => {
    it('throws when SESSION_SECRET is not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SESSION_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          require('../../src/config/session');
        });
      }).toThrow('SESSION_SECRET environment variable is required in non-test environments');
    });
  });

  describe('in a test environment (NODE_ENV=test)', () => {
    it('does not throw even when SESSION_SECRET is absent', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.SESSION_SECRET;

      expect(() => {
        jest.isolateModules(() => {
          require('../../src/config/session');
        });
      }).not.toThrow();
    });
  });
});
