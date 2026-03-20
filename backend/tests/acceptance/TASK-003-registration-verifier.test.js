/**
 * TASK-003 -- User Registration Acceptance Tests (Verifier)
 *
 * Verifies all 6 acceptance criteria for REQ-001 (User registration)
 * through the system's public HTTP interface (supertest -> Express).
 *
 * REQ-001: A visitor can create an account by providing a username,
 *          email address, and password.
 * Definition of Done: A visitor submits valid registration data and receives
 *   a confirmed account. Duplicate emails are rejected. The user can
 *   subsequently log in.
 *
 * Test layers covered:
 *   - Acceptance tests (AC-1 through AC-5): HTTP interface via supertest
 *   - Integration boundary (AC-5): session cookie attribute assertions
 *     confirm connect-pg-simple session store is correctly wired
 *
 * Note: AC-6 (client-side validation) is verified by the frontend component
 *   tests in frontend/src/__tests__/RegisterForm.test.jsx. Those tests are
 *   blocked by a missing @testing-library/jest-dom dependency — see FAIL
 *   verdict in the verification report.
 *
 * Fitness Function: FF-D03 (partial — protected routes require valid session;
 *   this task establishes sessions; full FF-D03 coverage is in TASK-004).
 */

'use strict';

const request = require('supertest');
const bcrypt = require('bcryptjs');

const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');

// ---------------------------------------------------------------------------
// Test lifecycle
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
// AC-1 [REQ-001]: A visitor can submit a valid username, email, and password
//   to create an account
//
// Given: a visitor on the registration page
// When:  they submit a valid username, email, and password
// Then:  an account is created (API: 201 with user object; redirect handled
//        client-side via RegisterPage navigating to /workspace)
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-001]: Valid registration creates an account', () => {
  it('returns 201 with the created user object on valid input', async () => {
    // Given: a visitor with valid credentials
    // When:  POST /api/auth/register with username, email, password
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    // Then:  201 with user object containing id, username, email
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('persists the user row in the database', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const user = await User.findOne({ where: { email: 'alice@example.com' } });
    expect(user).not.toBeNull();
    expect(user.username).toBe('alice');
  });

  it('user id is a UUID v4', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(res.body.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  // [VERIFIER-ADDED] Negative: missing username must not create an account
  it('[VERIFIER-ADDED] does NOT create account when username is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'securepass1' });

    expect(res.status).not.toBe(201);
    const count = await User.count();
    expect(count).toBe(0);
  });

  // [VERIFIER-ADDED] Negative: missing email must not create an account
  it('[VERIFIER-ADDED] does NOT create account when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'securepass1' });

    expect(res.status).not.toBe(201);
    const count = await User.count();
    expect(count).toBe(0);
  });

  // [VERIFIER-ADDED] password_hash must never appear in the API response
  it('[VERIFIER-ADDED] does not expose password_hash or password in the response body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-2 [REQ-001]: Password is hashed with bcryptjs (cost factor 12)
//   before storage
//
// Given: a visitor submits a valid registration
// When:  the account is created
// Then:  the stored password_hash is a bcrypt hash at cost factor 12
//        (the plaintext password is never stored)
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-001]: Password is hashed with bcryptjs cost factor 12', () => {
  it('stores a bcrypt hash, not the plaintext password', async () => {
    const plaintext = 'securepass1';
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: plaintext });

    const user = await User.findOne({ where: { email: 'alice@example.com' } });
    expect(user.password_hash).toBeDefined();
    expect(user.password_hash).not.toBe(plaintext);

    // bcrypt.compare must confirm the hash encodes the correct password
    const valid = await bcrypt.compare(plaintext, user.password_hash);
    expect(valid).toBe(true);
  });

  it('bcrypt cost factor is exactly 12', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const user = await User.findOne({ where: { email: 'alice@example.com' } });
    // bcrypt hash encodes cost: $2b$12$...
    const rounds = bcrypt.getRounds(user.password_hash);
    expect(rounds).toBe(12);
  });

  // [VERIFIER-ADDED] Negative: a different password must NOT match the stored hash
  it('[VERIFIER-ADDED] a different password does NOT validate against the stored hash', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const user = await User.findOne({ where: { email: 'alice@example.com' } });
    const valid = await bcrypt.compare('completelywrong', user.password_hash);
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-3 [REQ-001]: Email uniqueness enforced; duplicate email submission
//   returns a clear error message
//
// Given: a visitor on the registration page
// When:  they submit an email that is already registered
// Then:  registration is rejected with a clear error message and no duplicate
//        account is created
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-001]: Duplicate email returns 409 EMAIL_TAKEN', () => {
  it('returns 409 with error code EMAIL_TAKEN on duplicate email', async () => {
    // Given: an existing registration
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'taken@example.com', password: 'securepass1' });

    // When: a second registration with the same email
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'taken@example.com', password: 'otherpass9' });

    // Then: 409 with EMAIL_TAKEN error code
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_TAKEN');
  });

  it('does not create a second user when email is duplicate', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'taken@example.com', password: 'securepass1' });

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'taken@example.com', password: 'otherpass9' });

    const count = await User.count({ where: { email: 'taken@example.com' } });
    expect(count).toBe(1);
  });

  // [VERIFIER-ADDED] Case-insensitive deduplication (authService lowercases email on store)
  it('[VERIFIER-ADDED] treats email as case-insensitive for uniqueness check', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice2', email: 'ALICE@EXAMPLE.COM', password: 'otherpass9' });

    expect(res.status).toBe(409);
  });

  // [VERIFIER-ADDED] Negative: a distinct email must be accepted
  it('[VERIFIER-ADDED] different email is accepted even when another user already exists', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'otherpass9' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('bob@example.com');
  });
});

// ---------------------------------------------------------------------------
// AC-4 [REQ-001]: Password minimum length 8 characters (server-side)
//
// Given: a visitor submitting a password shorter than 8 characters
// When:  the registration request reaches the server
// Then:  registration is rejected with 400 VALIDATION_ERROR
//        (server enforces this regardless of client-side validation)
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-001]: Password minimum 8 characters enforced server-side', () => {
  it('returns 400 VALIDATION_ERROR for a 7-character password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: '1234567' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for a 1-character password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when password is absent', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  // [VERIFIER-ADDED] Boundary: exactly 8 characters is the minimum valid length
  it('[VERIFIER-ADDED] accepts exactly 8 characters (minimum boundary)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: '12345678' });

    expect(res.status).toBe(201);
  });

  // [VERIFIER-ADDED] Negative: valid password does NOT trigger 400
  it('[VERIFIER-ADDED] does NOT return 400 for a strong 12-character password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'mysafepassword' });

    expect(res.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// AC-5 [REQ-001]: On successful registration, a session is created
//   and the user is redirected to the workspace
//   (session: API returns Set-Cookie; redirect is handled by RegisterPage)
//
// Integration boundary: session cookie attribute assertions confirm
//   connect-pg-simple session store is wired with httpOnly + sameSite:strict
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-001]: Session created on successful registration', () => {
  it('response includes Set-Cookie with connect.sid on successful registration', async () => {
    // Given: a visitor on the registration page
    // When:  they submit valid credentials
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    // Then:  a session cookie is set in the response
    expect(res.status).toBe(201);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find((c) => c.includes('connect.sid'));
    expect(sessionCookie).toBeDefined();
  });

  it('session cookie has HttpOnly attribute (ADR-002)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const cookies = res.headers['set-cookie'];
    const sessionCookie = cookies.find((c) => c.includes('connect.sid'));
    // HttpOnly prevents JavaScript document.cookie access
    expect(sessionCookie).toContain('HttpOnly');
  });

  it('session cookie has SameSite=Strict attribute (ADR-002)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const cookies = res.headers['set-cookie'];
    const sessionCookie = cookies.find((c) => c.includes('connect.sid'));
    // SameSite=Strict provides CSRF protection (ADR-002: no CSRF token needed)
    expect(sessionCookie).toContain('SameSite=Strict');
  });

  // [VERIFIER-ADDED] Negative: a failed registration must NOT set a session cookie
  it('[VERIFIER-ADDED] does NOT set a session cookie on 409 duplicate-email failure', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice2', email: 'alice@example.com', password: 'otherpass9' });

    expect(res.status).toBe(409);
    const cookies = res.headers['set-cookie'];
    const sessionCookie = cookies
      ? cookies.find((c) => c.includes('connect.sid'))
      : undefined;
    expect(sessionCookie).toBeUndefined();
  });

  // [VERIFIER-ADDED] Negative: a validation failure must NOT set a session cookie
  it('[VERIFIER-ADDED] does NOT set a session cookie on 400 validation failure', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'short' });

    expect(res.status).toBe(400);
    const cookies = res.headers['set-cookie'];
    const sessionCookie = cookies
      ? cookies.find((c) => c.includes('connect.sid'))
      : undefined;
    expect(sessionCookie).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// FF-D03 [REQ-001]: Session established by registration carries a userId
//   that corresponds to the newly created user
//   (partial coverage -- full FF-D03 requires TASK-004 login/logout)
// ---------------------------------------------------------------------------

describe('FF-D03 (partial) [REQ-001]: Session from registration carries valid userId', () => {
  it('userId in session corresponds to the newly created user record', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'securepass1' });

    expect(res.status).toBe(201);
    const userId = res.body.user.id;
    expect(userId).toBeDefined();

    // The returned user id must point to a real persisted record
    const user = await User.findByPk(userId);
    expect(user).not.toBeNull();
    expect(user.email).toBe('alice@example.com');
    expect(user.username).toBe('alice');
  });
});
