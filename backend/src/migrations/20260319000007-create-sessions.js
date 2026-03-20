/**
 * Migration: Create session table.
 *
 * Creates the connect-pg-simple session store table. The schema matches the
 * exact structure expected by connect-pg-simple: a varchar primary key (sid),
 * a JSON session payload (sess), and a timestamp for expiry-based eviction
 * (expire). An index on expire supports efficient garbage collection queries
 * performed by connect-pg-simple.
 *
 * This migration replaces the createTableIfMissing option that was previously
 * enabled on the store, ensuring the table is provisioned through the standard
 * migration lifecycle rather than at application startup.
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('session', {
      sid: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      sess: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      expire: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('session', ['expire'], {
      name: 'session_expire_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('session');
  },
};
