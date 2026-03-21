/**
 * Folders API module.
 *
 * Client-side functions for folder CRUD endpoints. Each function corresponds
 * to one route in the backend's src/routes/folders.js.
 *
 * Folders are single-level organizational containers for notes (ADR-003).
 * Nested folder creation is not supported.
 */

import { get, post, put, del } from './client.js';

/**
 * Returns all folders belonging to the authenticated user, sorted by name ASC.
 *
 * @returns {Promise<{ folders: Array<{ id: string, name: string, created_at: string, updated_at: string }> }>}
 * @throws {ApiError} 401 if not authenticated
 */
export async function getFolders() {
  return get('/api/folders');
}

/**
 * Creates a new folder with the given name.
 *
 * @param {string} name - Folder display name (must be non-empty)
 * @returns {Promise<{ folder: { id: string, name: string, created_at: string, updated_at: string } }>}
 * @throws {ApiError} 400 if name is empty or missing
 * @throws {ApiError} 401 if not authenticated
 *
 * @precondition name is a non-empty string
 * @postcondition The returned folder is owned by the authenticated user
 */
export async function createFolder(name) {
  return post('/api/folders', { name });
}

/**
 * Renames a folder.
 *
 * @param {string} folderId - UUID of the folder to rename
 * @param {string} name - New display name (must be non-empty)
 * @returns {Promise<{ folder: { id: string, name: string, updated_at: string } }>}
 * @throws {ApiError} 404 if folder does not exist or belongs to another user
 * @throws {ApiError} 400 if name is empty or missing
 *
 * @precondition folderId references an existing folder owned by the authenticated user
 * @precondition name is a non-empty string
 * @postcondition folders.name is updated; folders.updated_at is refreshed
 */
export async function updateFolder(folderId, name) {
  return put(`/api/folders/${folderId}`, { name });
}

/**
 * Permanently deletes a folder.
 *
 * Notes inside the deleted folder are moved to root level (folder_id set to
 * NULL via ON DELETE SET NULL at the database level -- ADR-003). Notes are
 * not deleted.
 *
 * @param {string} folderId - UUID of the folder to delete
 * @returns {Promise<null>} Resolves to null on success (204 No Content)
 * @throws {ApiError} 404 if folder does not exist or belongs to another user
 *
 * @precondition folderId references an existing folder owned by the authenticated user
 * @postcondition Folder row is deleted
 * @postcondition All notes that were in this folder have folder_id = null
 */
export async function deleteFolder(folderId) {
  return del(`/api/folders/${folderId}`);
}
