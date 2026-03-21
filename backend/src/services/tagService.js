/**
 * Tag service.
 *
 * Encapsulates all tag-related business logic (ADR-010). Route handlers delegate
 * to this service. All methods assume the caller has already verified authentication.
 * User isolation is enforced via the userId parameter in every query.
 */

'use strict';

const { Tag, NoteTag, Note, sequelize } = require('../models');

/**
 * Regex for valid tag names: Unicode letters, digits, and hyphens only.
 * No spaces. Per Nexus clarification at Requirements Gate v4.
 */
const TAG_NAME_REGEX = /^[\p{L}\d-]+$/u;

/**
 * Validates a tag name against the allowed character set and length.
 *
 * @param {string} name - The raw tag name to validate
 * @throws {Error} With message 'VALIDATION_ERROR' if the name is invalid
 */
function validateTagName(name) {
  if (!name || typeof name !== 'string') {
    const err = new Error('Tag name is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    const err = new Error('Tag name is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (trimmed.length > 50) {
    const err = new Error('Tag name must be 50 characters or fewer');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (/\s/.test(trimmed)) {
    const err = new Error('Tag name must not contain spaces');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!TAG_NAME_REGEX.test(trimmed)) {
    const err = new Error('Tag name may only contain letters, digits, and hyphens');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
}

/**
 * Returns all tags belonging to the given user, sorted by name ASC.
 *
 * @param {string} userId - UUID of the authenticated user
 * @returns {Promise<Tag[]>} Array of Tag instances
 */
async function getTags(userId) {
  return Tag.scope({ method: ['forUser', userId] }).findAll({
    order: [['name', 'ASC']],
  });
}

/**
 * Creates a new tag for the given user. If a tag with the same name (case-insensitive)
 * already exists, returns the existing tag instead.
 *
 * @param {string} userId - UUID of the authenticated user
 * @param {string} rawName - The tag name (will be normalized to lowercase)
 * @returns {Promise<{tag: Tag, created: boolean}>} The tag and whether it was newly created
 * @throws {Error} With code 'VALIDATION_ERROR' if the name is invalid
 */
async function createTag(userId, rawName) {
  validateTagName(rawName);

  const name = rawName.trim().toLowerCase();

  const [tag, created] = await Tag.findOrCreate({
    where: { user_id: userId, name },
    defaults: { user_id: userId, name },
  });

  return { tag, created };
}

/**
 * Deletes a tag and all its note associations (CASCADE).
 *
 * @param {string} tagId - UUID of the tag to delete
 * @param {string} userId - UUID of the authenticated user
 * @throws {Error} With message 'NOT_FOUND' if the tag does not exist or belongs to another user
 */
async function deleteTag(tagId, userId) {
  const tag = await Tag.scope({ method: ['forUser', userId] }).findOne({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error('NOT_FOUND');
  }

  await tag.destroy();
}

/**
 * Adds a tag to a note. Supports both tagId (existing tag) and name (inline creation).
 *
 * @param {string} noteId - UUID of the note
 * @param {string} userId - UUID of the authenticated user
 * @param {object} params - Either { tagId } or { name }
 * @returns {Promise<Tag>} The tag that was added
 * @throws {Error} With message 'NOT_FOUND' if the note or tag does not exist or belongs to another user
 */
async function addTagToNote(noteId, userId, { tagId, name }) {
  // Verify note ownership
  const note = await Note.scope({ method: ['forUser', userId] }).findOne({
    where: { id: noteId },
  });

  if (!note) {
    throw new Error('NOT_FOUND');
  }

  let tag;

  if (tagId) {
    // Use existing tag -- verify ownership
    tag = await Tag.scope({ method: ['forUser', userId] }).findOne({
      where: { id: tagId },
    });

    if (!tag) {
      throw new Error('NOT_FOUND');
    }
  } else if (name) {
    // Inline creation -- create or find existing tag
    const result = await createTag(userId, name);
    tag = result.tag;
  } else {
    const err = new Error('Either tagId or name is required');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Add the association (ignore if already exists)
  await NoteTag.findOrCreate({
    where: { note_id: noteId, tag_id: tag.id },
    defaults: { note_id: noteId, tag_id: tag.id },
  });

  return tag;
}

/**
 * Removes a tag association from a note.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} tagId - UUID of the tag
 * @param {string} userId - UUID of the authenticated user
 * @throws {Error} With message 'NOT_FOUND' if the note, tag, or association does not exist
 */
async function removeTagFromNote(noteId, tagId, userId) {
  // Verify note ownership
  const note = await Note.scope({ method: ['forUser', userId] }).findOne({
    where: { id: noteId },
  });

  if (!note) {
    throw new Error('NOT_FOUND');
  }

  // Verify tag ownership
  const tag = await Tag.scope({ method: ['forUser', userId] }).findOne({
    where: { id: tagId },
  });

  if (!tag) {
    throw new Error('NOT_FOUND');
  }

  const association = await NoteTag.findOne({
    where: { note_id: noteId, tag_id: tagId },
  });

  if (!association) {
    throw new Error('NOT_FOUND');
  }

  await association.destroy();
}

/**
 * Returns notes for a user, optionally filtered by tag IDs (OR logic).
 *
 * @param {string} userId - UUID of the authenticated user
 * @param {string[]} [tagIds] - Optional array of tag UUIDs to filter by (OR logic)
 * @returns {Promise<Note[]>} Array of Note instances with tags included
 */
async function getNotesWithTags(userId, tagIds) {
  const includeOptions = [
    {
      model: Tag,
      as: 'tags',
      through: { attributes: [] }, // exclude junction table fields
      attributes: ['id', 'name'],
    },
  ];

  const queryOptions = {
    attributes: ['id', 'title', 'updated_at', 'folder_id'],
    include: includeOptions,
    order: [['updated_at', 'DESC']],
    subQuery: false,
  };

  if (tagIds && tagIds.length > 0) {
    // Filter by tags (OR logic): find notes that have ANY of the specified tags
    const { Op } = require('sequelize');

    // First, find note IDs that have any of the specified tags
    const noteTagRows = await NoteTag.findAll({
      where: { tag_id: { [Op.in]: tagIds } },
      attributes: ['note_id'],
      group: ['note_id'],
    });

    const matchingNoteIds = noteTagRows.map((row) => row.note_id);

    if (matchingNoteIds.length === 0) {
      return [];
    }

    queryOptions.where = {
      id: { [Op.in]: matchingNoteIds },
    };
  }

  return Note.scope({ method: ['forUser', userId] }).findAll(queryOptions);
}

module.exports = {
  getTags,
  createTag,
  deleteTag,
  addTagToNote,
  removeTagFromNote,
  getNotesWithTags,
  validateTagName,
};
