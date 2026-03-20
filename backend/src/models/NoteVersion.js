/**
 * NoteVersion model.
 *
 * Represents an immutable snapshot of a note at a point in time. Versions are
 * created by versionService when content has changed after a 30-second idle
 * period (ADR-004). Rows are never updated -- only inserted and read.
 *
 * Table: note_versions
 *
 * Fields:
 *   id             UUID, primary key, default gen_random_uuid()
 *   note_id        UUID, not null, FK -> notes(id) ON DELETE CASCADE
 *   title          VARCHAR(500), not null -- snapshot of note.title at creation time
 *   body           TEXT, not null -- snapshot of note.body at creation time
 *   version_number INTEGER, not null -- monotonically increasing per note (1-based)
 *   created_at     TIMESTAMPTZ, not null, default NOW() -- no updated_at (immutable)
 *
 * Constraints:
 *   - (note_id, version_number) must be unique per note
 *   - version_number is managed server-side by versionService (not auto-increment at DB level)
 *   - No updated_at field (rows are immutable snapshots)
 *
 * Ordering:
 *   Default sort: version_number DESC (newest version first, REQ-016)
 *
 * Scopes (ADR-006):
 *   Access is restricted to the owning user via the parent note's user_id.
 *   RLS policy enforces this at the DB level via subquery on notes.
 */

'use strict';

const { Model, DataTypes } = require('sequelize');

class NoteVersion extends Model {}

/**
 * Initializes the NoteVersion model with field definitions and options.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {typeof NoteVersion} The initialized NoteVersion model class
 */
function initNoteVersion(sequelize) {
  NoteVersion.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      note_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      version_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'note_versions',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
      defaultScope: {
        order: [['version_number', 'DESC']],
      },
    }
  );

  return NoteVersion;
}

module.exports = NoteVersion;
module.exports.initNoteVersion = initNoteVersion;
