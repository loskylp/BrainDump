/**
 * Migration: Create note_tags junction table.
 *
 * ADR-010: Many-to-many relationship between notes and tags.
 * Composite PK (note_id, tag_id). CASCADE on both FKs.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('note_tags', {
      note_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'notes',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      tag_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'tags',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Index for querying notes by tag
    await queryInterface.addIndex('note_tags', ['tag_id'], {
      name: 'idx_note_tags_tag_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('note_tags');
  },
};
