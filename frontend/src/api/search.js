/**
 * Search API module.
 *
 * Client-side function for the full-text search endpoint.
 */

import { get as _get } from './client.js';

/**
 * Searches the authenticated user's notes using full-text search.
 *
 * Calls GET /api/search?q={query} and returns the parsed JSON response.
 * The response contains a results array with { id, title, snippet } objects,
 * where snippet is HTML with <mark>term</mark> highlights from ts_headline.
 *
 * @param {string} query - Raw search string from the user input
 * @returns {Promise<{ results: Array<{ id: string, title: string, snippet: string }> }>}
 * @throws {ApiError} 400 if query is empty after sanitization on the server
 */
export async function search(query) {
  return _get(`/api/search?q=${encodeURIComponent(query)}`);
}
