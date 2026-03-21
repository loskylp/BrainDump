/**
 * Migration: Update search vector trigger to include tag names at weight C.
 *
 * ADR-010: Tags are included in the search vector so users can find notes
 * by searching for tag names. Weight C is lower than title (A) and body (B).
 *
 * Also creates a trigger on note_tags to refresh the note's search_vector
 * when tags are added or removed.
 */

'use strict';

module.exports = {
  async up(queryInterface) {
    // Create a function that refreshes a note's search_vector including tags
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION notes_search_vector_update() RETURNS trigger AS $$
      DECLARE
          tag_text TEXT;
      BEGIN
          SELECT string_agg(t.name, ' ') INTO tag_text
          FROM note_tags nt
          JOIN tags t ON t.id = nt.tag_id
          WHERE nt.note_id = NEW.id;

          NEW.search_vector :=
              setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
              setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'B') ||
              setweight(to_tsvector('english', COALESCE(tag_text, '')), 'C');
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create a function that refreshes a note's search_vector when tags change
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION refresh_note_search_vector() RETURNS trigger AS $$
      DECLARE
          note_record RECORD;
          tag_text TEXT;
          target_note_id UUID;
      BEGIN
          -- Determine which note_id to update
          IF TG_OP = 'DELETE' THEN
              target_note_id := OLD.note_id;
          ELSE
              target_note_id := NEW.note_id;
          END IF;

          -- Get the note's current title and body
          SELECT id, title, body INTO note_record
          FROM notes
          WHERE id = target_note_id;

          IF NOT FOUND THEN
              RETURN COALESCE(NEW, OLD);
          END IF;

          -- Get all tag names for this note
          SELECT string_agg(t.name, ' ') INTO tag_text
          FROM note_tags nt
          JOIN tags t ON t.id = nt.tag_id
          WHERE nt.note_id = target_note_id;

          -- Update the note's search_vector
          UPDATE notes SET search_vector =
              setweight(to_tsvector('english', COALESCE(note_record.title, '')), 'A') ||
              setweight(to_tsvector('english', COALESCE(note_record.body, '')), 'B') ||
              setweight(to_tsvector('english', COALESCE(tag_text, '')), 'C')
          WHERE id = target_note_id;

          RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger on note_tags to refresh search vector when tags are added/removed
    await queryInterface.sequelize.query(`
      CREATE TRIGGER note_tags_search_vector_trigger
          AFTER INSERT OR DELETE ON note_tags
          FOR EACH ROW
          EXECUTE FUNCTION refresh_note_search_vector();
    `);
  },

  async down(queryInterface) {
    // Drop the note_tags trigger
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS note_tags_search_vector_trigger ON note_tags'
    );

    // Drop the refresh function
    await queryInterface.sequelize.query(
      'DROP FUNCTION IF EXISTS refresh_note_search_vector()'
    );

    // Restore original search vector trigger function (without tags)
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
  },
};
