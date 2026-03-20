/**
 * User model.
 *
 * Represents a registered BrainDump account. Users own all notes, note
 * versions, folders, and password reset tokens (all deleted via CASCADE
 * when the user row is deleted -- see ADR-003).
 *
 * Table: users
 *
 * Fields:
 *   id            UUID, primary key, default gen_random_uuid()
 *   username      VARCHAR(50), not null -- display name only, not for login
 *   email         VARCHAR(255), not null, unique -- login credential
 *   password_hash VARCHAR(255), not null -- bcrypt hash, cost factor 12 (ADR-002)
 *   created_at    TIMESTAMPTZ, not null, default NOW()
 *   updated_at    TIMESTAMPTZ, not null, default NOW()
 *
 * Constraints:
 *   - Email UNIQUE (database-enforced; duplicate email returns a clear error, ADR-002)
 *   - password_hash is never exposed via toJSON() (virtual exclude)
 *
 * Model methods (defined in model class):
 *   instance.comparePassword(plaintext: string): Promise<boolean>
 *     Compares a plaintext password against this user's stored hash.
 *     Returns true if the password matches, false otherwise.
 *     Does NOT throw on mismatch -- only throws on bcrypt error.
 */

'use strict';

const bcrypt = require('bcryptjs');
const { Model, DataTypes } = require('sequelize');

class User extends Model {
  /**
   * Compares a plaintext password against this user's stored bcrypt hash.
   *
   * Delegates directly to bcryptjs.compare, which returns false on mismatch
   * and only throws on an unexpected bcrypt internal error.
   *
   * @param {string} plaintext - The password provided by the user at login.
   * @returns {Promise<boolean>} True if the password matches the stored hash, false otherwise.
   * @throws {Error} If bcrypt comparison fails unexpectedly (not on wrong password).
   *
   * @precondition this.password_hash is a valid bcrypt hash (set on registration)
   * @postcondition Returns false for wrong password without throwing
   */
  async comparePassword(plaintext) {
    return bcrypt.compare(plaintext, this.password_hash);
  }

  /**
   * Override toJSON to exclude password_hash from serialized output.
   * Prevents accidental exposure of password hashes in API responses.
   *
   * @returns {Object} User data without password_hash
   */
  toJSON() {
    const values = { ...this.get() };
    delete values.password_hash;
    return values;
  }
}

/**
 * Initializes the User model with field definitions and options.
 *
 * @param {import('sequelize').Sequelize} sequelize - The Sequelize instance
 * @returns {typeof User} The initialized User model class
 */
function initUser(sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'users',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return User;
}

module.exports = User;
module.exports.initUser = initUser;
