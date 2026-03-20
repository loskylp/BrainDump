/**
 * Migration: Create note_versions table.
 *
 * ADR-003: Immutable version snapshots. UUID PK, note_id FK (CASCADE).
 * No updated_at column -- rows are never modified.
 * Composite index on (note_id, version_number DESC) for efficient listing.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('note_versions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      note_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'notes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      version_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Composite index for efficient version listing (newest first)
    await queryInterface.sequelize.query(
      'CREATE INDEX idx_note_versions_note_id ON note_versions(note_id, version_number DESC)'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('note_versions');
  },
};
