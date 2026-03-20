/**
 * Sequelize model loader.
 *
 * Initialises each model file, registers model associations, and exports
 * both the Sequelize instance and a named map of all models. This module is
 * the single import point for any file that needs database access.
 *
 * Exported shape:
 *   {
 *     sequelize: Sequelize,   -- the live Sequelize instance
 *     User: Model,
 *     Note: Model,
 *     NoteVersion: Model,
 *     Folder: Model,
 *   }
 *
 * Associations defined here (ADR-003 FK relationships):
 *   - User hasMany Note (foreignKey: user_id, onDelete: CASCADE)
 *   - User hasMany Folder (foreignKey: user_id, onDelete: CASCADE)
 *   - Note belongsTo User (foreignKey: user_id)
 *   - Note belongsTo Folder (foreignKey: folder_id, onDelete: SET NULL)
 *   - Note hasMany NoteVersion (foreignKey: note_id, onDelete: CASCADE)
 *   - NoteVersion belongsTo Note (foreignKey: note_id)
 *   - Folder hasMany Note (foreignKey: folder_id)
 */

'use strict';

const sequelize = require('../config/database');
const User = require('./User');
const { initUser } = require('./User');
const Note = require('./Note');
const { initNote } = require('./Note');
const NoteVersion = require('./NoteVersion');
const { initNoteVersion } = require('./NoteVersion');
const Folder = require('./Folder');
const { initFolder } = require('./Folder');

// Initialize all models
initUser(sequelize);
initFolder(sequelize);
initNote(sequelize);
initNoteVersion(sequelize);

// Define associations (ADR-003 FK relationships)

// User -> Notes (one-to-many, CASCADE on delete)
User.hasMany(Note, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
  as: 'notes',
});
Note.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// User -> Folders (one-to-many, CASCADE on delete)
User.hasMany(Folder, {
  foreignKey: 'user_id',
  onDelete: 'CASCADE',
  as: 'folders',
});
Folder.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// Folder -> Notes (one-to-many, SET NULL on delete)
Folder.hasMany(Note, {
  foreignKey: 'folder_id',
  as: 'notes',
});
Note.belongsTo(Folder, {
  foreignKey: 'folder_id',
  onDelete: 'SET NULL',
  as: 'folder',
});

// Note -> NoteVersions (one-to-many, CASCADE on delete)
Note.hasMany(NoteVersion, {
  foreignKey: 'note_id',
  onDelete: 'CASCADE',
  as: 'versions',
});
NoteVersion.belongsTo(Note, {
  foreignKey: 'note_id',
  as: 'note',
});

module.exports = {
  sequelize,
  User,
  Note,
  NoteVersion,
  Folder,
};
