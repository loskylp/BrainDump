/**
 * Tag model.
 *
 * Represents a user-defined label for cross-cutting note organization (ADR-010).
 * Tags are per-user (each user has their own namespace). Tag names are stored
 * lowercase, limited to 50 characters, and may contain Unicode letters, digits,
 * and hyphens (no spaces).
 *
 * Table: tags
 *
 * Fields:
 *   id          UUID, primary key, default gen_random_uuid()
 *   user_id     UUID, not null, FK -> users(id) ON DELETE CASCADE
 *   name        VARCHAR(50), not null -- tag display name (stored lowercase)
 *   created_at  TIMESTAMPTZ, not null, default NOW()
 *
 * Constraints:
 *   - UNIQUE(user_id, name) -- per-user tag uniqueness
 *
 * Scopes (ADR-006):
 *   forUser(userId) - Filters to tags owned by the specified user.
 */

'use strict';

const { Model, DataTypes } = require('sequelize');

class Tag extends Model {}

/**
 * Initializes the Tag model with field definitions, scopes, and options.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {typeof Tag} The initialized Tag model class
 */
function initTag(sequelize) {
  Tag.init(
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
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          len: [1, 50],
        },
      },
    },
    {
      sequelize,
      tableName: 'tags',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false, // tags table has no updated_at column
      scopes: {
        forUser(userId) {
          return {
            where: { user_id: userId },
          };
        },
      },
    }
  );

  return Tag;
}

module.exports = Tag;
module.exports.initTag = initTag;
