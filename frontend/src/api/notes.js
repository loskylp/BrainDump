/**
 * Notes API module.
 *
 * Client-side functions for note CRUD endpoints. Each function corresponds
 * to one route in the backend's src/routes/notes.js.
 */

// TODO: TASK-009 (updateNote), TASK-010 (deleteNote)
import { get, post, put, del } from './client.js';

/**
 * Returns all notes for the authenticated user, sorted by updated_at DESC.
 *
 * Body is excluded from each note in the response — the backend omits it
 * for list performance. Call getNote(id) to retrieve the full body.
 *
 * @returns {Promise<{ notes: Array<{ id: string, title: string, updated_at: string, folder_id: string|null }> }>}
 */
export async function getNotes() {
  return get('/api/notes');
}

/**
 * Creates a new note.
 *
 * @param {object} params
 * @param {string} [params.title=''] - Initial note title
 * @param {string} [params.folderId] - Optional folder UUID
 * @returns {Promise<{ note: { id: string, title: string, body: string, folder_id: string|null, created_at: string, updated_at: string } }>}
 */
export async function createNote({ title = '', folderId } = {}) {
  return post('/api/notes', { title, folderId });
}

/**
 * Returns the full content of a single note, including body.
 *
 * @param {string} noteId - UUID of the note
 * @returns {Promise<{ note: { id: string, title: string, body: string, folder_id: string|null, created_at: string, updated_at: string } }>}
 * @throws {ApiError} 404 if note not found or not owned by authenticated user
 */
export async function getNote(noteId) {
  return get(`/api/notes/${noteId}`);
}

/**
 * Updates a note's title and/or body. This is the auto-save path.
 *
 * @param {string} noteId - UUID of the note
 * @param {object} updates
 * @param {string} [updates.title]
 * @param {string} [updates.body]
 * @param {string|null} [updates.folderId]
 * @returns {Promise<{ note: { id: string, title: string, body: string, updated_at: string } }>}
 * @throws {ApiError} 404 if note not found or not owned by authenticated user
 */
export async function updateNote(noteId, updates) {
  // TODO: TASK-009 -- implement: put(`/api/notes/${noteId}`, updates)
  throw new Error('Not implemented');
}

/**
 * Permanently deletes a note and all its versions.
 *
 * @param {string} noteId - UUID of the note
 * @returns {Promise<void>}
 * @throws {ApiError} 404 if note not found or not owned by authenticated user
 */
export async function deleteNote(noteId) {
  // TODO: TASK-010 -- implement: del(`/api/notes/${noteId}`)
  throw new Error('Not implemented');
}
