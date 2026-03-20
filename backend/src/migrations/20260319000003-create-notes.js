/**
 * Migration: Create notes table with search_vector, trigger, and GIN index.
 *
 * ADR-003: Notes with UUID PK, user_id FK (CASCADE), folder_id FK (SET NULL).
 * ADR-005: search_vector TSVECTOR column with weighted trigger and GIN index.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notes', {
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
      folder_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'folders',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      title: {
        type: Sequelize.STRING(500),
        allowNull: false,
        defaultValue: '',
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      search_vector: {
        type: 'TSVECTOR',
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // GIN index on search_vector (ADR-005)
    await queryInterface.sequelize.query(
      'CREATE INDEX idx_notes_search ON notes USING GIN(search_vector)'
    );

    // Search vector trigger function (ADR-005)
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION notes_search_vector_update() RETURNS trigger AS $$
      BEGIN
          NEW.search_vector :=
              setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
              setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B');
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger fires BEFORE INSERT OR UPDATE OF title, body
    await queryInterface.sequelize.query(`
      CREATE TRIGGER notes_search_vector_trigger
          BEFORE INSERT OR UPDATE OF title, body ON notes
          FOR EACH ROW
          EXECUTE FUNCTION notes_search_vector_update();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS notes_search_vector_trigger ON notes'
    );
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS notes_search_vector_update()'
    );
    await queryInterface.dropTable('notes');
  },
};
