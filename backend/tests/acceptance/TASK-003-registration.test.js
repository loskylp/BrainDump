/**
 * TASK-003 -- User Registration Acceptance Tests
 *
 * Tests all 6 acceptance criteria for REQ-001 (User registration):
 *   AC-1: A visitor can submit a valid username, email, and password to create an account
 *   AC-2: Password is hashed with bcryptjs (cost factor 12) before storage
 *   AC-3: Email uniqueness enforced; duplicate email returns clear error
 *   AC-4: Password minimum length: 8 characters (server-side validation)
 *   AC-5: On successful registration, a session is created
 *   AC-6: Client-side validation (covered in frontend tests)
 *
 * Fitness Function: FF-D03 (protected routes return 401 without valid session)
 */

'use strict';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const { sequelize, User } = require('../../src/models');

beforeAll(async () => {
  // Ensure tables exist (migrations should have run)
  await sequelize.authenticate();
});

afterEach(async () => {
  // Clean up test users after each test
  await User.destroy({ where: {}, force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('POST /api/auth/register', () => {
  // AC-1: A visitor can submit a valid username, email, and password to create an account
  describe('AC-1: successful registration', () => {
    it('returns 201 with user object on valid input', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.username).toBe('testuser');
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('does not expose password_hash in the response', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.password).toBeUndefined();
    });

    it('persists the user in the database', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const user = await User.findOne({ where: { email: 'test@example.com' } });
      expect(user).not.toBeNull();
      expect(user.username).toBe('testuser');
    });

    it('generates a UUID primary key for the user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(res.body.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('trims whitespace from username and email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: '  testuser  ',
          email: '  Test@Example.com  ',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.username).toBe('testuser');
      expect(res.body.user.email).toBe('test@example.com');
    });
  });

  // AC-2: Password is hashed with bcryptjs (cost factor 12) before storage
  describe('AC-2: password hashing', () => {
    it('stores the password as a bcrypt hash', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const user = await User.findOne({ where: { email: 'test@example.com' } });
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe('password123');

      // Verify bcrypt can validate the hash
      const isValid = await bcrypt.compare('password123', user.password_hash);
      expect(isValid).toBe(true);
    });

    it('uses bcrypt cost factor 12', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const user = await User.findOne({ where: { email: 'test@example.com' } });
      // bcrypt hash format: $2a$12$... or $2b$12$... -- the 12 is the cost factor
      const rounds = bcrypt.getRounds(user.password_hash);
      expect(rounds).toBe(12);
    });
  });

  // AC-3: Email uniqueness enforced; duplicate email returns clear error
  describe('AC-3: email uniqueness', () => {
    it('returns 409 with EMAIL_TAKEN for duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      // Attempt to register with same email
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'duplicate@example.com',
          password: 'password456',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('EMAIL_TAKEN');
    });

    it('does not create a second user when email is duplicate', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'duplicate@example.com',
          password: 'password456',
        });

      const count = await User.count({ where: { email: 'duplicate@example.com' } });
      expect(count).toBe(1);
    });

    it('treats email comparison as case-insensitive', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user1',
          email: 'test@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'user2',
          email: 'TEST@EXAMPLE.COM',
          password: 'password456',
        });

      expect(res.status).toBe(409);
    });
  });

  // AC-4: Password minimum length: 8 characters (server-side validation)
  describe('AC-4: password validation', () => {
    it('returns 400 for password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for exactly 7 character password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '1234567',
        });

      expect(res.status).toBe(400);
    });

    it('accepts exactly 8 character password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: '12345678',
        });

      expect(res.status).toBe(201);
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // Additional validation tests
  describe('input validation', () => {
    it('returns 400 for missing username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for empty username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: '   ',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'not-an-email',
          password: 'password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // AC-5: On successful registration, a session is created
  describe('AC-5: session creation', () => {
    it('sets a session cookie on successful registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      // express-session sets a 'connect.sid' cookie by default
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const sessionCookie = cookies.find((c) => c.includes('connect.sid'));
      expect(sessionCookie).toBeDefined();
    });

    it('session cookie is httpOnly', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const cookies = res.headers['set-cookie'];
      const sessionCookie = cookies.find((c) => c.includes('connect.sid'));
      expect(sessionCookie).toContain('HttpOnly');
    });

    it('session cookie has SameSite=Strict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });

      const cookies = res.headers['set-cookie'];
      const sessionCookie = cookies.find((c) => c.includes('connect.sid'));
      expect(sessionCookie).toContain('SameSite=Strict');
    });
  });
});
