/**
 * Migration: Enable Row-Level Security on notes, folders, and note_versions.
 *
 * ADR-006: Defense-in-depth data isolation. RLS is enabled AND forced on all
 * three tables. FORCE ensures even the table owner is subject to RLS policies.
 *
 * Policies use current_setting('app.current_user_id')::uuid to identify the
 * requesting user. The rlsContext middleware sets this variable via SET LOCAL
 * at the start of each request.
 *
 * OBS-002: The migration role (braindump_dev / braindump_test) is the table
 * owner. Because FORCE ROW LEVEL SECURITY applies to owners too, this migration
 * must run AFTER all schema migrations. The RLS policies include a BYPASSRLS
 * exemption note: the migration user bypasses RLS because it is the table
 * owner AND we use ALTER USER ... BYPASSRLS (handled separately), OR the
 * migration role uses SET LOCAL to set app.current_user_id when needed.
 *
 * In practice for this project: migrations run via docker-entrypoint.sh before
 * the app starts. The migration role only runs DDL (CREATE TABLE, ALTER TABLE),
 * not DML (INSERT/UPDATE/DELETE on RLS-protected tables). DDL operations are
 * not subject to RLS policies -- only DML is filtered by RLS. Therefore the
 * migration role can safely operate without BYPASSRLS for schema migrations.
 *
 * For seed data or test fixtures that need to INSERT into RLS-protected tables,
 * the test/seed scripts must SET LOCAL app.current_user_id before the INSERT.
 */

'use strict';

module.exports = {
  async up(queryInterface) {
    // Enable RLS on all three tables
    await queryInterface.sequelize.query('ALTER TABLE notes ENABLE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE folders ENABLE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY');

    // Force RLS even on table owner (ADR-006)
    await queryInterface.sequelize.query('ALTER TABLE notes FORCE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE folders FORCE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE note_versions FORCE ROW LEVEL SECURITY');

    // Policy: users can only access rows matching their current_user_id
    await queryInterface.sequelize.query(`
      CREATE POLICY user_isolation_notes ON notes
          USING (user_id = current_setting('app.current_user_id')::uuid)
    `);

    await queryInterface.sequelize.query(`
      CREATE POLICY user_isolation_folders ON folders
          USING (user_id = current_setting('app.current_user_id')::uuid)
    `);

    // note_versions: access controlled via parent note's user_id
    await queryInterface.sequelize.query(`
      CREATE POLICY user_isolation_versions ON note_versions
          USING (note_id IN (SELECT id FROM notes WHERE user_id = current_setting('app.current_user_id')::uuid))
    `);
  },

  async down(queryInterface) {
    // Drop policies
    await queryInterface.sequelize.query('DROP POLICY IF EXISTS user_isolation_notes ON notes');
    await queryInterface.sequelize.query('DROP POLICY IF EXISTS user_isolation_folders ON folders');
    await queryInterface.sequelize.query('DROP POLICY IF EXISTS user_isolation_versions ON note_versions');

    // Disable RLS
    await queryInterface.sequelize.query('ALTER TABLE notes DISABLE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE folders DISABLE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE note_versions DISABLE ROW LEVEL SECURITY');

    // Remove FORCE
    await queryInterface.sequelize.query('ALTER TABLE notes NO FORCE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE folders NO FORCE ROW LEVEL SECURITY');
    await queryInterface.sequelize.query('ALTER TABLE note_versions NO FORCE ROW LEVEL SECURITY');
  },
};
