/**
 * NoteTag model (junction table).
 *
 * Represents the many-to-many relationship between notes and tags (ADR-010).
 * Composite primary key (note_id, tag_id). CASCADE on both FKs.
 *
 * Table: note_tags
 *
 * Fields:
 *   note_id     UUID, not null, FK -> notes(id) ON DELETE CASCADE
 *   tag_id      UUID, not null, FK -> tags(id) ON DELETE CASCADE
 *   created_at  TIMESTAMPTZ, not null, default NOW()
 */

'use strict';

const { Model, DataTypes } = require('sequelize');

class NoteTag extends Model {}

/**
 * Initializes the NoteTag model with field definitions and options.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {typeof NoteTag} The initialized NoteTag model class
 */
function initNoteTag(sequelize) {
  NoteTag.init(
    {
      note_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      tag_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
    },
    {
      sequelize,
      tableName: 'note_tags',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false, // note_tags table has no updated_at column
    }
  );

  return NoteTag;
}

module.exports = NoteTag;
module.exports.initNoteTag = initNoteTag;
