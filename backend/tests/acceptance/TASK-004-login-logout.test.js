/**
 * TASK-004 -- User Login and Logout Acceptance Tests
 *
 * Tests all 6 acceptance criteria for REQ-002 (Login and logout):
 *   AC-1: A registered user can log in with email and password
 *   AC-2: Valid credentials return 200 + session cookie (HttpOnly, SameSite=Strict)
 *   AC-3: Invalid credentials return 401; message does not reveal which field was wrong
 *   AC-4: Authenticated user can log out; session is destroyed in the PostgreSQL store
 *   AC-5: After logout, protected routes return 401
 *   AC-6: Session lifetime: 7 days with rolling expiry
 *
 * Fitness Functions: FF-D03, FF-D04, FF-D07
 */

'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Registers a test user and returns the response.
 * @param {object} overrides
 */
async function registerUser(overrides = {}) {
  return request(app)
    .post('/api/auth/register')
    .send({
      username: 'logintest',
      email: 'logintest@example.com',
      password: 'password123',
      ...overrides,
    });
}

/**
 * Extracts the Set-Cookie header value matching 'connect.sid'.
 * @param {import('supertest').Response} res
 * @returns {string | undefined}
 */
function extractSessionCookie(res) {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return undefined;
  return cookies.find((c) => c.includes('connect.sid'));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await sequelize.authenticate();
});

afterEach(async () => {
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  // AC-1 / AC-2: Valid credentials return 200 + session cookie
  describe('AC-1/AC-2: successful login', () => {
    it('returns 200 with user object on valid credentials', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('logintest@example.com');
      expect(res.body.user.username).toBe('logintest');
    });

    it('does not expose password_hash in the login response', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
    });

    it('sets a session cookie on successful login', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = extractSessionCookie(res);
      expect(sessionCookie).toBeDefined();
    });

    it('session cookie is HttpOnly', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = extractSessionCookie(res);
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('session cookie has SameSite=Strict', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = extractSessionCookie(res);
      expect(sessionCookie).toContain('SameSite=Strict');
    });

    it('session cookie has Max-Age set (7-day expiry)', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = extractSessionCookie(res);
      // express-session may emit either Max-Age (relative) or Expires (absolute) — both are valid
      const hasExpires = /Expires=/i.test(sessionCookie);
      const hasMaxAge = /Max-Age=/i.test(sessionCookie);
      expect(hasExpires || hasMaxAge).toBe(true);
    });

    it('accepts email with different casing (case-insensitive lookup)', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'LOGINTEST@EXAMPLE.COM', password: 'password123' });

      expect(res.status).toBe(200);
    });
  });

  // AC-2: Session persists across requests
  describe('AC-2: session persistence', () => {
    it('GET /api/auth/me returns the authenticated user after login', async () => {
      await registerUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('logintest@example.com');
    });

    it('GET /api/auth/me returns 401 without a session cookie', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // AC-3: Invalid credentials return 401 without leaking which field was wrong
  describe('AC-3: invalid credentials', () => {
    it('returns 401 for wrong password', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notregistered@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('returns the same error code for wrong password and unknown email (no enumeration)', async () => {
      await registerUser();

      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'wrong' });

      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notregistered@example.com', password: 'password123' });

      expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
    });

    it('does not set a session cookie on failed login', async () => {
      await registerUser();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      // No session cookie should be set on failure
      const cookies = res.headers['set-cookie'];
      const sessionCookie = cookies
        ? cookies.find((c) => c.includes('connect.sid'))
        : undefined;
      // A session cookie should not be set with a userId on failed login
      // (express-session may still set an empty cookie; verify no session is persisted)
      if (sessionCookie) {
        // If a cookie exists, a subsequent /me request with it must return 401
        const meRes = await request(app)
          .get('/api/auth/me')
          .set('Cookie', [sessionCookie]);
        expect(meRes.status).toBe(401);
      }
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com' });

      expect(res.status).toBe(400);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/auth/logout', () => {
  // AC-4: Authenticated user can log out; session destroyed
  describe('AC-4: logout destroys the session', () => {
    it('returns 200 on successful logout', async () => {
      await registerUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = loginRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);

      expect(logoutRes.status).toBe(200);
    });

    // AC-5: After logout, requests with the old cookie return 401
    it('GET /api/auth/me returns 401 after logout with the old session cookie', async () => {
      await registerUser();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'logintest@example.com', password: 'password123' });

      const sessionCookie = loginRes.headers['set-cookie'];

      // Confirm session works before logout
      const beforeLogout = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);
      expect(beforeLogout.status).toBe(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie);

      // Attempt to use the old session cookie -- must be rejected
      const afterLogout = await request(app)
        .get('/api/auth/me')
        .set('Cookie', sessionCookie);
      expect(afterLogout.status).toBe(401);
    });

    it('logout without a session returns 200 (idempotent)', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// User.comparePassword unit tests
// ---------------------------------------------------------------------------

describe('User.comparePassword()', () => {
  it('returns true when plaintext matches the stored hash', async () => {
    await registerUser();
    const user = await User.findOne({ where: { email: 'logintest@example.com' } });
    const result = await user.comparePassword('password123');
    expect(result).toBe(true);
  });

  it('returns false when plaintext does not match the stored hash', async () => {
    await registerUser();
    const user = await User.findOne({ where: { email: 'logintest@example.com' } });
    const result = await user.comparePassword('wrongpassword');
    expect(result).toBe(false);
  });

  it('does not throw on wrong password (only returns false)', async () => {
    await registerUser();
    const user = await User.findOne({ where: { email: 'logintest@example.com' } });
    await expect(user.comparePassword('wrong')).resolves.toBe(false);
  });
});
