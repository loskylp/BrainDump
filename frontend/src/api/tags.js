/**
 * Tags API module.
 *
 * Client-side functions for tag CRUD and note-tag association endpoints.
 * Each function corresponds to one route in the backend's tagging API.
 *
 * Follows the same fetch pattern as api/notes.js: delegates to the shared
 * HTTP client (api/client.js) which attaches session credentials and handles
 * non-2xx error throwing.
 */

import { get, post, del } from './client.js';

/**
 * Returns all tags for the authenticated user, sorted alphabetically.
 *
 * @returns {Promise<{ tags: Array<{ id: string, name: string, created_at: string }> }>}
 */
export async function getTags() {
  return get('/api/tags');
}

/**
 * Creates a new tag for the authenticated user.
 *
 * The backend normalises the name to lowercase and deduplicates case-insensitively,
 * returning the existing tag if one with the same normalised name already exists.
 *
 * @param {string} name - Tag name (must not contain spaces; Unicode letters, digits, hyphens only)
 * @returns {Promise<{ tag: { id: string, name: string, created_at: string } }>}
 * @throws {ApiError} 422 if name is invalid (spaces, > 50 chars, disallowed characters)
 */
export async function createTag(name) {
  return post('/api/tags', { name });
}

/**
 * Permanently deletes a tag and cascades the removal from all associated notes.
 *
 * @param {string} id - UUID of the tag to delete
 * @returns {Promise<null>} Resolves to null on 204 No Content
 * @throws {ApiError} 404 if the tag is not found or not owned by the authenticated user
 */
export async function deleteTag(id) {
  return del(`/api/tags/${id}`);
}

/**
 * Adds a tag to a note. Accepts either an existing tag id or an inline name
 * (which the backend creates if it does not already exist).
 *
 * @param {string} noteId - UUID of the note
 * @param {{ tagId?: string, name?: string }} payload - Either tagId or name must be provided
 * @returns {Promise<{ tag: { id: string, name: string } }>}
 * @throws {ApiError} 404 if the note or tag is not found or not owned by the authenticated user
 */
export async function addTagToNote(noteId, payload) {
  return post(`/api/notes/${noteId}/tags`, payload);
}

/**
 * Removes a tag association from a note. Does not delete the tag itself.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} tagId - UUID of the tag to remove from the note
 * @returns {Promise<null>} Resolves to null on 204 No Content
 * @throws {ApiError} 404 if the note or tag is not found or the association does not exist
 */
export async function removeTagFromNote(noteId, tagId) {
  return del(`/api/notes/${noteId}/tags/${tagId}`);
}
