/**
 * Versions API module.
 *
 * Client-side functions for version history and restore endpoints. Each
 * function corresponds to one route in the backend's src/routes/versions.js.
 */

// TODO: TASK-013
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
  // TODO: TASK-013 -- implement: post(`/api/notes/${noteId}/check-version`)
  throw new Error('Not implemented');
}

/**
 * Returns all versions of a note, ordered newest first.
 *
 * @param {string} noteId - UUID of the note
 * @returns {Promise<{ versions: Array<{ id: string, version_number: number, created_at: string }> }>}
 * @throws {ApiError} 404 if note not found or not owned by authenticated user
 */
export async function getVersions(noteId) {
  // TODO: TASK-013 -- implement: get(`/api/notes/${noteId}/versions`)
  throw new Error('Not implemented');
}

/**
 * Restores a note to a specific version.
 *
 * @param {string} noteId - UUID of the note
 * @param {string} versionId - UUID of the version to restore from
 * @returns {Promise<{ note: { id: string, title: string, body: string, updated_at: string }, newVersionNumber: number }>}
 * @throws {ApiError} 404 if note or version not found
 * @throws {ApiError} 400 if versionId does not belong to noteId
 */
export async function restoreVersion(noteId, versionId) {
  // TODO: TASK-013 -- implement: post(`/api/notes/${noteId}/versions/restore/${versionId}`)
  throw new Error('Not implemented');
}
