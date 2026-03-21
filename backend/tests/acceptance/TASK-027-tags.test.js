/**
 * Verifier Acceptance Tests — TASK-027: Global tagging system backend
 *
 * REQ-021: User can tag notes with user-defined labels and filter by tag
 * ADR-010: Global Tagging System Schema and Integration
 *
 * These tests operate through the system's public HTTP interface (supertest
 * against the Express app) and directly against the database via Sequelize
 * for persistence verification where specified by the ADR fitness functions.
 * No implementation internals are accessed beyond the models import path.
 *
 * Acceptance criteria covered:
 *   AC-1   tags table schema: id (UUID PK), user_id (FK CASCADE), name (VARCHAR 50),
 *           created_at; UNIQUE(user_id, name)
 *   AC-2   note_tags junction table schema: note_id (FK CASCADE), tag_id (FK CASCADE),
 *           created_at; composite PK (note_id, tag_id)
 *   AC-3   Tag model has forUser(userId) scope
 *   AC-4   POST /api/tags: creates a tag; name normalized to lowercase; rejects
 *           names > 50 chars, names with spaces, names with non-allowed characters
 *   AC-5   DELETE /api/tags/:id: deletes a tag and CASCADE removes all note_tags;
 *           ownership guard enforced
 *   AC-6   POST /api/notes/:id/tags: adds a tag by { tagId } or { name } for inline
 *           creation; ownership guard on both note and tag
 *   AC-7   DELETE /api/notes/:id/tags/:tagId: removes a tag association; ownership
 *           guard enforced
 *   AC-8   GET /api/tags: returns all tags for the authenticated user
 *   AC-9   GET /api/notes and GET /api/notes?tags=id1,id2 return notes with their tags
 *           included; OR filter logic
 *   AC-10  Search vector includes tag names at weight C; search results include tags
 *           in response metadata
 *   AC-11  Per-user isolation: User A cannot see, create, or manipulate User B's tags
 *   AC-12  Creating tag "Research" when "research" already exists returns existing tag
 *           (case-insensitive dedup)
 *
 * Run from the backend/ directory:
 *   POSTGRES_URL=postgresql://braindump_dev:braindump_dev@localhost:5432/braindump_dev \
 *   SESSION_SECRET=test-secret NODE_ENV=test \
 *   npx jest --testPathPattern=TASK-027 --forceExit --runInBand
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const request = require('supertest');
const app = require('../../src/app');
const { sequelize, Tag, NoteTag, Note } = require('../../src/models');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Registers a new user and returns { cookie, userId }.
 */
async function registerUser(overrides = {}) {
  const suffix = Date.now() + Math.random().toString(36).slice(2, 7);
  const defaults = {
    username: `t27_${suffix}`,
    email: `t27_${suffix}@example.com`,
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
 * Creates a tag via the API and returns the created tag object.
 */
async function createTag(cookie, name) {
  const res = await request(app)
    .post('/api/tags')
    .set('Cookie', cookie)
    .send({ name });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`createTag failed (status ${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.tag;
}

/**
 * Creates a note via the API and returns the created note object.
 */
async function createNote(cookie, title = 'Test Note') {
  const res = await request(app)
    .post('/api/notes')
    .set('Cookie', cookie)
    .send({ title });
  if (res.status !== 201) {
    throw new Error(`createNote failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.note;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await sequelize.authenticate();
});

afterEach(async () => {
  // Remove all test users (cascades to tags, note_tags, notes)
  await sequelize.query(`DELETE FROM users WHERE email LIKE 't27_%@example.com'`);
});

afterAll(async () => {
  await sequelize.close();
});

// ---------------------------------------------------------------------------
// AC-1: tags table schema
// REQ-021: Tags must persist with correct structure
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-021]: tags table has correct schema — id, user_id, name, created_at, UNIQUE(user_id, name)', () => {
  test('Given a user creates a tag, the persisted row has id (UUID), user_id, name, created_at', async () => {
    // Given: an authenticated user
    const { cookie, userId } = await registerUser();

    // When: the user creates a tag
    const tag = await createTag(cookie, 'research');

    // Then: the database row has the required columns
    const [rows] = await sequelize.query(
      `SELECT id, user_id, name, created_at FROM tags WHERE id = :id`,
      { replacements: { id: tag.id } }
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(row.user_id).toBe(userId);
    expect(row.name).toBe('research');
    expect(row.created_at).toBeTruthy();
  });

  // [VERIFIER-ADDED] Negative: UNIQUE(user_id, name) enforced at the DB level
  test('[VERIFIER-ADDED] Given a tag exists, inserting a duplicate (user_id, name) pair at DB level is rejected', async () => {
    const { userId } = await registerUser();

    // Insert one tag directly
    await sequelize.query(
      `INSERT INTO tags (id, user_id, name, created_at)
       VALUES (gen_random_uuid(), :userId, 'duplicate', NOW())`,
      { replacements: { userId } }
    );

    // Attempt to insert a second row with the same (user_id, name) — must fail
    await expect(
      sequelize.query(
        `INSERT INTO tags (id, user_id, name, created_at)
         VALUES (gen_random_uuid(), :userId, 'duplicate', NOW())`,
        { replacements: { userId } }
      )
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-2: note_tags junction table schema
// REQ-021: Note-tag associations must persist with correct structure
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-021]: note_tags table has correct schema — composite PK, FK CASCADE on both sides', () => {
  test('Given a tag is added to a note, a note_tags row with note_id, tag_id, created_at is persisted', async () => {
    // Given: an authenticated user with a note and a tag
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Tagged Note');
    const tag = await createTag(cookie, 'mytag');

    // When: the tag is added to the note
    const res = await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });
    expect(res.status).toBe(200);

    // Then: a note_tags row exists with note_id, tag_id, created_at
    const [rows] = await sequelize.query(
      `SELECT note_id, tag_id, created_at FROM note_tags WHERE note_id = :noteId AND tag_id = :tagId`,
      { replacements: { noteId: note.id, tagId: tag.id } }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].note_id).toBe(note.id);
    expect(rows[0].tag_id).toBe(tag.id);
    expect(rows[0].created_at).toBeTruthy();
  });

  test('Given a note is deleted, its note_tags associations are CASCADE removed', async () => {
    // Given: a note with a tag association
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Will Be Deleted');
    const tag = await createTag(cookie, 'cascade-tag');
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // When: the note is deleted
    const del = await request(app)
      .delete(`/api/notes/${note.id}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(204);

    // Then: no note_tags rows remain for that note
    const [rows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE note_id = :noteId`,
      { replacements: { noteId: note.id } }
    );
    expect(rows).toHaveLength(0);
    // The tag itself still exists
    const remainingTag = await Tag.findByPk(tag.id);
    expect(remainingTag).toBeTruthy();
  });

  test('Given a tag is deleted, its note_tags associations are CASCADE removed', async () => {
    // Given: a note with a tag association
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Tagged Note');
    const tag = await createTag(cookie, 'tag-to-delete');
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // When: the tag is deleted
    const del = await request(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(204);

    // Then: no note_tags rows remain for that tag
    const [rows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE tag_id = :tagId`,
      { replacements: { tagId: tag.id } }
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Tag model forUser(userId) scope
// REQ-021: User isolation at the model layer
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-021]: Tag model has forUser(userId) scope that filters by user_id', () => {
  test('Given two users each have a tag, forUser scope returns only the queried user\'s tags', async () => {
    // Given: two users with their own tags
    const userA = await registerUser();
    const userB = await registerUser();
    await createTag(userA.cookie, 'alpha');
    await createTag(userB.cookie, 'beta');

    // When: querying tags scoped to userA
    const tagsForA = await Tag.scope({ method: ['forUser', userA.userId] }).findAll();

    // Then: only userA's tag is returned
    const names = tagsForA.map((t) => t.name);
    expect(names).toContain('alpha');
    expect(names).not.toContain('beta');
  });

  // [VERIFIER-ADDED] Negative: forUser scope with a random userId returns empty
  test('[VERIFIER-ADDED] forUser scope with a non-existent userId returns an empty array', async () => {
    const { cookie } = await registerUser();
    await createTag(cookie, 'orphan');

    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    const tags = await Tag.scope({ method: ['forUser', fakeUserId] }).findAll();
    expect(tags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: POST /api/tags — validation and normalization
// REQ-021: Tag creation with validation rules
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-021]: POST /api/tags creates a tag with normalized lowercase name', () => {
  test('Given an authenticated user, when POST /api/tags with a valid name, then 201 is returned with the tag', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: the user posts a valid tag name
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'research' });

    // Then: 201 and tag returned
    expect(res.status).toBe(201);
    expect(res.body.tag).toMatchObject({ name: 'research' });
    expect(res.body.created).toBe(true);
  });

  test('Given a tag name with uppercase letters, the stored name is lowercased', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: the user posts "Research" (mixed case)
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'Research' });

    // Then: the tag is stored as "research"
    expect(res.status).toBe(201);
    expect(res.body.tag.name).toBe('research');
  });

  test('Given a valid Unicode name with accented letters, the tag is accepted', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: posting a tag name with accented characters
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'naïve' });

    // Then: 201 returned (Unicode letters are allowed)
    expect(res.status).toBe(201);
  });

  test('Given a valid hyphenated name, the tag is accepted', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: posting a tag name with a hyphen
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'in-progress' });

    // Then: 201 returned
    expect(res.status).toBe(201);
  });

  // Negative: name > 50 characters
  test('Given a name exceeding 50 characters, POST /api/tags returns 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: posting a 51-character name
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'a'.repeat(51) });

    // Then: 400 is returned
    expect(res.status).toBe(400);
  });

  // Negative: name with spaces
  test('Given a name containing spaces, POST /api/tags returns 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: posting a name with spaces
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'my tag' });

    // Then: 400 is returned
    expect(res.status).toBe(400);
  });

  // Negative: name with non-allowed characters (e.g. @, !)
  test('Given a name with non-allowed characters (e.g. @), POST /api/tags returns 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: posting a name with "@"
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'tag@name' });

    // Then: 400 is returned
    expect(res.status).toBe(400);
  });

  // Negative: empty name
  test('Given an empty name, POST /api/tags returns 400 VALIDATION_ERROR', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: posting an empty string
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: '' });

    // Then: 400 is returned
    expect(res.status).toBe(400);
  });

  // Negative: unauthenticated request
  test('[VERIFIER-ADDED] Given no session, POST /api/tags returns 401', async () => {
    const res = await request(app)
      .post('/api/tags')
      .send({ name: 'test' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AC-5: DELETE /api/tags/:id — ownership guard and CASCADE
// REQ-021: Tag deletion removes associations; only owner may delete
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-021]: DELETE /api/tags/:id deletes the tag and CASCADE removes note_tags', () => {
  test('Given the tag owner, when DELETE /api/tags/:id, then 204 is returned', async () => {
    // Given: an authenticated user with a tag
    const { cookie } = await registerUser();
    const tag = await createTag(cookie, 'temporary');

    // When: the owner deletes the tag
    const res = await request(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Cookie', cookie);

    // Then: 204 is returned and the tag is gone
    expect(res.status).toBe(204);
    const remaining = await Tag.findByPk(tag.id);
    expect(remaining).toBeNull();
  });

  test('Given a tag with note associations, deleting the tag CASCADE removes all note_tags rows', async () => {
    // Given: a note with a tag
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Note With Tag');
    const tag = await createTag(cookie, 'removeme');
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // When: the tag is deleted
    await request(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Cookie', cookie);

    // Then: no note_tags row remains for this tag
    const [rows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE tag_id = :tagId`,
      { replacements: { tagId: tag.id } }
    );
    expect(rows).toHaveLength(0);
  });

  // Negative: ownership guard — User B cannot delete User A's tag
  test('Given User B trying to delete User A\'s tag, DELETE /api/tags/:id returns 404', async () => {
    // Given: User A creates a tag; User B is a different user
    const userA = await registerUser();
    const userB = await registerUser();
    const tagA = await createTag(userA.cookie, 'usera-tag');

    // When: User B attempts to delete User A's tag
    const res = await request(app)
      .delete(`/api/tags/${tagA.id}`)
      .set('Cookie', userB.cookie);

    // Then: 404 is returned (not 403 — ownership mismatch looks like not found)
    expect(res.status).toBe(404);

    // And: the tag still exists
    const remaining = await Tag.findByPk(tagA.id);
    expect(remaining).toBeTruthy();
  });

  // [VERIFIER-ADDED] Negative: non-existent tag id returns 404
  test('[VERIFIER-ADDED] Given a non-existent tag id, DELETE /api/tags/:id returns 404', async () => {
    const { cookie } = await registerUser();
    const fakeId = '00000000-0000-0000-0000-000000000099';

    const res = await request(app)
      .delete(`/api/tags/${fakeId}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// AC-6: POST /api/notes/:id/tags — add tag by tagId or name
// REQ-021: Inline tag creation when using { name }; ownership on both objects
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-021]: POST /api/notes/:id/tags adds a tag to a note by tagId or inline name', () => {
  test('Given a note and an existing tag, POST /api/notes/:id/tags with { tagId } returns 200 with the tag', async () => {
    // Given: an authenticated user with a note and a tag
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'My Note');
    const tag = await createTag(cookie, 'existing');

    // When: the user adds the tag by tagId
    const res = await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // Then: 200 and the tag is returned
    expect(res.status).toBe(200);
    expect(res.body.tag).toMatchObject({ id: tag.id, name: 'existing' });
  });

  test('Given a note and no pre-existing tag, POST /api/notes/:id/tags with { name } creates and adds the tag', async () => {
    // Given: an authenticated user with a note but no tag
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Inline Tag Note');

    // When: the user adds a tag by name (inline creation)
    const res = await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ name: 'newtag' });

    // Then: 200 and the newly created tag is returned
    expect(res.status).toBe(200);
    expect(res.body.tag).toMatchObject({ name: 'newtag' });

    // And: a note_tags row was created
    const [rows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE note_id = :noteId AND tag_id = :tagId`,
      { replacements: { noteId: note.id, tagId: res.body.tag.id } }
    );
    expect(rows).toHaveLength(1);
  });

  // Negative: ownership guard on note — cannot add tag to another user's note
  test('Given User B tries to add a tag to User A\'s note, returns 404', async () => {
    // Given: User A has a note; User B has a tag
    const userA = await registerUser();
    const userB = await registerUser();
    const noteA = await createNote(userA.cookie, 'Private Note');
    const tagB = await createTag(userB.cookie, 'user-b-tag');

    // When: User B tries to add a tag to User A's note
    const res = await request(app)
      .post(`/api/notes/${noteA.id}/tags`)
      .set('Cookie', userB.cookie)
      .send({ tagId: tagB.id });

    // Then: 404
    expect(res.status).toBe(404);
  });

  // Negative: ownership guard on tag — cannot add another user's tag to own note
  test('Given User B tries to add User A\'s tag to their own note, returns 404', async () => {
    // Given: User A has a tag; User B has a note
    const userA = await registerUser();
    const userB = await registerUser();
    const tagA = await createTag(userA.cookie, 'usera-only');
    const noteB = await createNote(userB.cookie, 'User B Note');

    // When: User B tries to add User A's tag to their own note
    const res = await request(app)
      .post(`/api/notes/${noteB.id}/tags`)
      .set('Cookie', userB.cookie)
      .send({ tagId: tagA.id });

    // Then: 404 (tag not found for user B)
    expect(res.status).toBe(404);
  });

  // [VERIFIER-ADDED] Negative: adding a tag to a non-existent note returns 404
  test('[VERIFIER-ADDED] Given a non-existent note id, POST /api/notes/:id/tags returns 404', async () => {
    const { cookie } = await registerUser();
    const tag = await createTag(cookie, 'orphan-tag');
    const fakeNoteId = '00000000-0000-0000-0000-000000000099';

    const res = await request(app)
      .post(`/api/notes/${fakeNoteId}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    expect(res.status).toBe(404);
  });

  // [VERIFIER-ADDED] Negative: adding a tag twice is idempotent (no duplicate note_tags row)
  test('[VERIFIER-ADDED] Adding the same tag to a note twice creates only one note_tags row', async () => {
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Idempotent Note');
    const tag = await createTag(cookie, 'idempotent');

    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // Add again
    const res2 = await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // Should succeed without error
    expect(res2.status).toBe(200);

    // Exactly one row in note_tags
    const [rows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE note_id = :noteId AND tag_id = :tagId`,
      { replacements: { noteId: note.id, tagId: tag.id } }
    );
    expect(rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-7: DELETE /api/notes/:id/tags/:tagId — remove tag association
// REQ-021: Ownership guard on remove
// ---------------------------------------------------------------------------

describe('AC-7 [REQ-021]: DELETE /api/notes/:id/tags/:tagId removes a tag association from a note', () => {
  test('Given a note with a tag, when DELETE /api/notes/:id/tags/:tagId, then 204 is returned', async () => {
    // Given: a note with a tag added
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Tagged');
    const tag = await createTag(cookie, 'removable');
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // When: the association is removed
    const res = await request(app)
      .delete(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Cookie', cookie);

    // Then: 204 and the note_tags row is gone
    expect(res.status).toBe(204);

    const [rows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE note_id = :noteId AND tag_id = :tagId`,
      { replacements: { noteId: note.id, tagId: tag.id } }
    );
    expect(rows).toHaveLength(0);

    // The tag itself still exists
    const remainingTag = await Tag.findByPk(tag.id);
    expect(remainingTag).toBeTruthy();
  });

  // Negative: ownership guard — User B cannot remove User A's note-tag association
  test('Given User B tries to remove a tag from User A\'s note, returns 404', async () => {
    // Given: User A has a note with a tag; User B is another user
    const userA = await registerUser();
    const userB = await registerUser();
    const noteA = await createNote(userA.cookie, 'A Note');
    const tagA = await createTag(userA.cookie, 'atag');
    await request(app)
      .post(`/api/notes/${noteA.id}/tags`)
      .set('Cookie', userA.cookie)
      .send({ tagId: tagA.id });

    // When: User B tries to remove the tag
    const res = await request(app)
      .delete(`/api/notes/${noteA.id}/tags/${tagA.id}`)
      .set('Cookie', userB.cookie);

    // Then: 404
    expect(res.status).toBe(404);
  });

  // [VERIFIER-ADDED] Negative: removing a non-existent association returns 404
  test('[VERIFIER-ADDED] Given no existing association, DELETE /api/notes/:id/tags/:tagId returns 404', async () => {
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Untagged Note');
    const tag = await createTag(cookie, 'notadded');

    const res = await request(app)
      .delete(`/api/notes/${note.id}/tags/${tag.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// AC-8: GET /api/tags — list user's tags
// REQ-021: Users can retrieve their tag list
// ---------------------------------------------------------------------------

describe('AC-8 [REQ-021]: GET /api/tags returns all tags for the authenticated user', () => {
  test('Given a user with three tags, GET /api/tags returns all three sorted alphabetically', async () => {
    // Given: an authenticated user with three tags
    const { cookie } = await registerUser();
    await createTag(cookie, 'zebra');
    await createTag(cookie, 'alpha');
    await createTag(cookie, 'middle');

    // When: the user fetches their tags
    const res = await request(app)
      .get('/api/tags')
      .set('Cookie', cookie);

    // Then: 200 with all three tags sorted by name ASC
    expect(res.status).toBe(200);
    expect(res.body.tags).toHaveLength(3);
    const names = res.body.tags.map((t) => t.name);
    expect(names).toEqual(['alpha', 'middle', 'zebra']);
  });

  test('Given a user with no tags, GET /api/tags returns an empty array', async () => {
    // Given: an authenticated user with no tags
    const { cookie } = await registerUser();

    // When: the user fetches their tags
    const res = await request(app)
      .get('/api/tags')
      .set('Cookie', cookie);

    // Then: 200 with an empty array
    expect(res.status).toBe(200);
    expect(res.body.tags).toHaveLength(0);
  });

  // Negative: unauthenticated request returns 401
  test('Given no session, GET /api/tags returns 401', async () => {
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
  });

  // [VERIFIER-ADDED] Each tag object includes id, name, created_at
  test('[VERIFIER-ADDED] GET /api/tags response includes id, name, created_at for each tag', async () => {
    const { cookie } = await registerUser();
    await createTag(cookie, 'fieldcheck');

    const res = await request(app)
      .get('/api/tags')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const tag = res.body.tags[0];
    expect(tag).toHaveProperty('id');
    expect(tag).toHaveProperty('name', 'fieldcheck');
    expect(tag).toHaveProperty('created_at');
  });
});

// ---------------------------------------------------------------------------
// AC-9: GET /api/notes and GET /api/notes?tags= — notes with tags, OR filter
// REQ-021: Notes list includes tag data; tag filter uses OR logic
// ---------------------------------------------------------------------------

describe('AC-9 [REQ-021]: GET /api/notes returns notes with tags included; ?tags= filter uses OR logic', () => {
  test('Given notes with tags, GET /api/notes includes a tags array on each note', async () => {
    // Given: a user with a note that has a tag
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Tagged Note');
    const tag = await createTag(cookie, 'included');
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // When: the user fetches their notes
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: 200 with the note's tags included
    expect(res.status).toBe(200);
    const fetchedNote = res.body.notes.find((n) => n.id === note.id);
    expect(fetchedNote).toBeTruthy();
    expect(Array.isArray(fetchedNote.tags)).toBe(true);
    expect(fetchedNote.tags).toContainEqual(
      expect.objectContaining({ id: tag.id, name: 'included' })
    );
  });

  test('Given a note without tags, GET /api/notes includes an empty tags array', async () => {
    // Given: a user with a note that has no tags
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Untagged Note');

    // When: the user fetches their notes
    const res = await request(app)
      .get('/api/notes')
      .set('Cookie', cookie);

    // Then: the note has an empty tags array
    expect(res.status).toBe(200);
    const fetchedNote = res.body.notes.find((n) => n.id === note.id);
    expect(fetchedNote.tags).toEqual([]);
  });

  test('Given two notes with different tags, ?tags=id1 filters to only the matching note (OR logic)', async () => {
    // Given: two notes each with a distinct tag
    const { cookie } = await registerUser();
    const noteA = await createNote(cookie, 'Note A');
    const noteB = await createNote(cookie, 'Note B');
    const tagA = await createTag(cookie, 'filter-alpha');
    const tagB = await createTag(cookie, 'filter-beta');
    await request(app)
      .post(`/api/notes/${noteA.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tagA.id });
    await request(app)
      .post(`/api/notes/${noteB.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tagB.id });

    // When: the user filters by tagA's id
    const res = await request(app)
      .get(`/api/notes?tags=${tagA.id}`)
      .set('Cookie', cookie);

    // Then: only Note A is returned
    expect(res.status).toBe(200);
    const ids = res.body.notes.map((n) => n.id);
    expect(ids).toContain(noteA.id);
    expect(ids).not.toContain(noteB.id);
  });

  test('Given two notes with different tags, ?tags=id1,id2 returns both (OR logic)', async () => {
    // Given: two notes each with a distinct tag
    const { cookie } = await registerUser();
    const noteA = await createNote(cookie, 'Note A OR');
    const noteB = await createNote(cookie, 'Note B OR');
    const tagA = await createTag(cookie, 'or-alpha');
    const tagB = await createTag(cookie, 'or-beta');
    await request(app)
      .post(`/api/notes/${noteA.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tagA.id });
    await request(app)
      .post(`/api/notes/${noteB.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tagB.id });

    // When: filtering by both tags
    const res = await request(app)
      .get(`/api/notes?tags=${tagA.id},${tagB.id}`)
      .set('Cookie', cookie);

    // Then: both notes are returned
    expect(res.status).toBe(200);
    const ids = res.body.notes.map((n) => n.id);
    expect(ids).toContain(noteA.id);
    expect(ids).toContain(noteB.id);
  });

  // Negative: filter by a tag id that matches no notes
  test('Given a tag id that is not on any note, ?tags=id returns an empty array', async () => {
    // Given: a user with a note and an unattached tag
    const { cookie } = await registerUser();
    await createNote(cookie, 'Untagged');
    const orphanTag = await createTag(cookie, 'orphan');

    // When: filtering by the orphan tag
    const res = await request(app)
      .get(`/api/notes?tags=${orphanTag.id}`)
      .set('Cookie', cookie);

    // Then: empty array
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(0);
  });

  // [VERIFIER-ADDED] Negative: tag filter from User B does not leak User A's notes
  test('[VERIFIER-ADDED] Given User B\'s tag id, ?tags= does not return User A\'s notes', async () => {
    // Given: User A has a note with a tag; User B knows User A's tag id
    const userA = await registerUser();
    const userB = await registerUser();
    const noteA = await createNote(userA.cookie, 'User A Private Note');
    const tagA = await createTag(userA.cookie, 'leaked');
    await request(app)
      .post(`/api/notes/${noteA.id}/tags`)
      .set('Cookie', userA.cookie)
      .send({ tagId: tagA.id });

    // When: User B queries with User A's tag id
    const res = await request(app)
      .get(`/api/notes?tags=${tagA.id}`)
      .set('Cookie', userB.cookie);

    // Then: no results (User B doesn't own any note with that tag)
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-10: Search vector includes tag names at weight C; search results include tags
// REQ-021: Tags are searchable; search results include tag metadata
// ---------------------------------------------------------------------------

describe('AC-10 [REQ-021]: Search vector includes tag names; search results include tags metadata', () => {
  test('Given a note tagged with "uniqueq27tag", searching for "uniqueq27tag" returns the note with tags in results', async () => {
    // Given: an authenticated user with a note and a distinctive tag
    const { cookie } = await registerUser();
    const note = await createNote(cookie, 'Searchable Note');
    const tag = await createTag(cookie, 'uniqueq27tag');

    // When: the tag is added to the note (triggers search vector refresh)
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', cookie)
      .send({ tagId: tag.id });

    // Give the DB trigger a moment (synchronous in PG AFTER trigger, so no actual wait needed)
    // Search for the tag name
    const res = await request(app)
      .get('/api/search?q=uniqueq27tag')
      .set('Cookie', cookie);

    // Then: the note appears in search results
    expect(res.status).toBe(200);
    const result = res.body.results.find((r) => r.id === note.id);
    expect(result).toBeTruthy();

    // And: tags are included in the result metadata
    expect(Array.isArray(result.tags)).toBe(true);
    expect(result.tags).toContainEqual(
      expect.objectContaining({ id: tag.id, name: 'uniqueq27tag' })
    );
  });

  // [VERIFIER-ADDED] Negative: searching for a tag that belongs to another user's note does not return that note
  test('[VERIFIER-ADDED] Searching for a tag name does not return another user\'s note', async () => {
    // Given: User A has a note tagged "secretlabel"; User B searches for "secretlabel"
    const userA = await registerUser();
    const userB = await registerUser();
    const noteA = await createNote(userA.cookie, 'User A Note');
    const tagA = await createTag(userA.cookie, 'secretlabel');
    await request(app)
      .post(`/api/notes/${noteA.id}/tags`)
      .set('Cookie', userA.cookie)
      .send({ tagId: tagA.id });

    // When: User B searches for "secretlabel"
    const res = await request(app)
      .get('/api/search?q=secretlabel')
      .set('Cookie', userB.cookie);

    // Then: no results for User B
    expect(res.status).toBe(200);
    const found = res.body.results.find((r) => r.id === noteA.id);
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-11: Per-user isolation
// REQ-021: User A cannot see, create, or manipulate User B's tags
// REQ-011: Per-user data isolation
// ---------------------------------------------------------------------------

describe('AC-11 [REQ-021][REQ-011]: Per-user isolation — User A cannot access User B\'s tags', () => {
  test('Given User A\'s tags, GET /api/tags for User B does not include User A\'s tags', async () => {
    // Given: User A has a tag; User B has a different tag
    const userA = await registerUser();
    const userB = await registerUser();
    await createTag(userA.cookie, 'user-a-only');
    await createTag(userB.cookie, 'user-b-only');

    // When: User B fetches their tags
    const res = await request(app)
      .get('/api/tags')
      .set('Cookie', userB.cookie);

    // Then: User A's tag is not present
    expect(res.status).toBe(200);
    const names = res.body.tags.map((t) => t.name);
    expect(names).not.toContain('user-a-only');
    expect(names).toContain('user-b-only');
  });

  test('Given User A\'s tag id, User B cannot delete it (ownership guard returns 404)', async () => {
    // Given: User A has a tag
    const userA = await registerUser();
    const userB = await registerUser();
    const tagA = await createTag(userA.cookie, 'protected-tag');

    // When: User B tries to delete User A's tag
    const res = await request(app)
      .delete(`/api/tags/${tagA.id}`)
      .set('Cookie', userB.cookie);

    // Then: 404
    expect(res.status).toBe(404);
  });

  test('Given User A deletes their account, all their tags and note_tags are removed (CASCADE)', async () => {
    // Given: User A has a tag and a note with that tag attached
    const userA = await registerUser();
    const note = await createNote(userA.cookie, 'A Note');
    const tag = await createTag(userA.cookie, 'cascade-on-delete');
    await request(app)
      .post(`/api/notes/${note.id}/tags`)
      .set('Cookie', userA.cookie)
      .send({ tagId: tag.id });

    // When: User A's account is deleted
    const delRes = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', userA.cookie)
      .send({ password: 'password123' });
    expect(delRes.status).toBe(204);

    // Then: User A's tag is gone
    const remainingTag = await Tag.findByPk(tag.id);
    expect(remainingTag).toBeNull();

    // And: no orphaned note_tags rows
    const [ntRows] = await sequelize.query(
      `SELECT * FROM note_tags WHERE tag_id = :tagId`,
      { replacements: { tagId: tag.id } }
    );
    expect(ntRows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-12: Case-insensitive dedup — creating "Research" when "research" exists
// REQ-021: Idempotent tag creation; returns existing tag
// ---------------------------------------------------------------------------

describe('AC-12 [REQ-021]: Creating "Research" when "research" already exists returns the existing tag', () => {
  test('Given a tag "research" exists, POST /api/tags with name "Research" returns 200 (not 201) with the existing tag', async () => {
    // Given: the tag "research" already exists for this user
    const { cookie } = await registerUser();
    const original = await createTag(cookie, 'research');
    expect(original.name).toBe('research');

    // When: the user creates a tag "Research" (different case)
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'Research' });

    // Then: 200 (not 201) is returned with the existing tag
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.tag.id).toBe(original.id);
    expect(res.body.tag.name).toBe('research');
  });

  test('Given a tag "RESEARCH" is created, the stored name is "research" (lowercase normalization)', async () => {
    // Given: an authenticated user
    const { cookie } = await registerUser();

    // When: tag "RESEARCH" is posted
    const res = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'RESEARCH' });

    // Then: stored as "research"
    expect(res.status).toBe(201);
    expect(res.body.tag.name).toBe('research');

    // When: tag "Research" is posted again
    const res2 = await request(app)
      .post('/api/tags')
      .set('Cookie', cookie)
      .send({ name: 'Research' });

    // Then: 200 and same id returned (dedup)
    expect(res2.status).toBe(200);
    expect(res2.body.tag.id).toBe(res.body.tag.id);
  });

  // [VERIFIER-ADDED] Negative: same name for different users creates distinct tags (no cross-user dedup)
  test('[VERIFIER-ADDED] Same tag name for different users creates separate tag rows with distinct ids', async () => {
    // Given: two users both create a tag "shared"
    const userA = await registerUser();
    const userB = await registerUser();
    const tagA = await createTag(userA.cookie, 'shared');
    const tagB = await createTag(userB.cookie, 'shared');

    // Then: they have different ids
    expect(tagA.id).not.toBe(tagB.id);
    expect(tagA.name).toBe('shared');
    expect(tagB.name).toBe('shared');
  });
});
