/**
 * Folder model.
 *
 * Represents a single-level organizational container owned by a user.
 * Folders are named buckets for notes -- no nesting (ADR-003). Deleting a
 * folder sets folder_id to NULL on all its notes (ON DELETE SET NULL).
 *
 * Table: folders
 *
 * Fields:
 *   id          UUID, primary key, default gen_random_uuid()
 *   user_id     UUID, not null, FK -> users(id) ON DELETE CASCADE
 *   name        VARCHAR(100), not null -- folder display name
 *   created_at  TIMESTAMPTZ, not null, default NOW()
 *   updated_at  TIMESTAMPTZ, not null, default NOW()
 *
 * Constraints:
 *   - No unique constraint on name (users may create folders with the same name)
 *   - Single-level only: no parent_folder_id column (nesting is explicitly excluded, ADR-003)
 *
 * Scopes (ADR-006):
 *   forUser(userId) - Filters to folders owned by the specified user.
 *   Enforced at application level by middleware and at DB level by RLS policy.
 */

'use strict';

const { Model, DataTypes } = require('sequelize');

class Folder extends Model {}

/**
 * Initializes the Folder model with field definitions, scopes, and options.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {typeof Folder} The initialized Folder model class
 */
function initFolder(sequelize) {
  Folder.init(
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
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'folders',
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
    }
  );

  return Folder;
}

module.exports = Folder;
module.exports.initFolder = initFolder;
