/**
 * Note model.
 *
 * Represents a Markdown note owned by a user, optionally placed in a folder.
 * The search_vector column is maintained by a PostgreSQL trigger (ADR-005);
 * Sequelize does not write to it directly.
 *
 * Table: notes
 *
 * Fields:
 *   id             UUID, primary key, default gen_random_uuid()
 *   user_id        UUID, not null, FK -> users(id) ON DELETE CASCADE
 *   folder_id      UUID, nullable, FK -> folders(id) ON DELETE SET NULL
 *   title          VARCHAR(500), not null, default ''
 *   body           TEXT, not null, default ''
 *   search_vector  TSVECTOR -- managed by DB trigger, read-only via Sequelize
 *   created_at     TIMESTAMPTZ, not null, default NOW()
 *   updated_at     TIMESTAMPTZ, not null, default NOW()
 *
 * Scopes (ADR-006):
 *   forUser(userId) - Filters to notes owned by the specified user.
 *   Applied per-request from req.session.userId via service functions.
 *   The per-call scope pattern is used instead of defaultScope because
 *   Sequelize's defaultScope is static and cannot reference per-request state.
 *
 * Ordering:
 *   Default sort: updated_at DESC (newest-first for catalog display, REQ-008)
 */

'use strict';

const { Model, DataTypes } = require('sequelize');

class Note extends Model {}

/**
 * Initializes the Note model with field definitions, scopes, and options.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {typeof Note} The initialized Note model class
 */
function initNote(sequelize) {
  Note.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      folder_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false,
        defaultValue: '',
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      search_vector: {
        type: DataTypes.TSVECTOR,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'notes',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      scopes: {
        forUser(userId) {
          return {
            where: { user_id: userId },
          };
        },
      },
      defaultScope: {
        order: [['updated_at', 'DESC']],
      },
    }
  );

  return Note;
}

module.exports = Note;
module.exports.initNote = initNote;
