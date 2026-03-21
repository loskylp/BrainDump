/**
 * Migration: Create tags table.
 *
 * ADR-010: Tags are user-owned text labels for cross-cutting note organization.
 * UNIQUE(user_id, name) enforces per-user tag uniqueness.
 * ON DELETE CASCADE on user_id ensures account deletion removes all tags.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tags', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Per-user tag uniqueness (ADR-010)
    await queryInterface.addConstraint('tags', {
      fields: ['user_id', 'name'],
      type: 'unique',
      name: 'uq_tags_user_id_name',
    });

    // Index for fast user-scoped tag queries
    await queryInterface.addIndex('tags', ['user_id'], {
      name: 'idx_tags_user_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tags');
  },
};
