/**
 * Versions API module.
 *
 * Client-side functions for version history and restore endpoints. Each
 * function corresponds to one route in the backend's src/routes/versions.js.
 */

import { get, post } from './client.js';

/**
 * Requests a version check from the server (the 30-second idle timer trigger).
 *
 * The server performs the diff and conditionally creates a new version.
 * The client does not need to know the current note content -- the server
 * reads it directly from the notes row (ADR-004).
 *
 * @param {string} noteId - UUID of the note to check
 * @returns {Promise<{ versionCreated: boolean, versionNumber: number | null }>}
 */
export async function checkVersion(noteId) {
  return post(`/api/notes/${noteId}/check-version`);
}

/**
 * Returns all versions of a note, ordered newest first.
 *
 * @param {string} noteId - UUID of the note
 * @returns {Promise<{ versions: Array<{ id: string, version_number: number, title: string, body: string, created_at: string }> }>}
 * @throws {ApiError} 404 if note not found or not owned by authenticated user
 */
export async function getVersions(noteId) {
  return get(`/api/notes/${noteId}/versions`);
}

/**
 * Returns the content of a specific version.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} versionId - UUID of the version
 * @returns {Promise<{ version: { id: string, version_number: number, title: string, body: string, created_at: string } }>}
 */
export async function getVersion(noteId, versionId) {
  return get(`/api/notes/${noteId}/versions/${versionId}`);
}

/**
 * Restores a note to a specific version.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} versionId - UUID of the version to restore from
 * @returns {Promise<{ note: { id: string, title: string, body: string, updated_at: string }, newVersionNumber: number }>}
 */
export async function restoreVersion(noteId, versionId) {
  return post(`/api/notes/${noteId}/versions/restore/${versionId}`);
}
