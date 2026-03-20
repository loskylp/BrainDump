/**
 * Search API module.
 *
 * Client-side function for the full-text search endpoint.
 */

// TODO: TASK-014
import { get } from './client.js';

/**
 * Searches the authenticated user's notes using full-text search.
 *
 * @param {string} query - Raw search string from the user input
 * @returns {Promise<{ results: Array<{ id: string, title: string, snippet: string }> }>}
 *   snippet contains HTML with <mark>term</mark> highlights from ts_headline.
 * @throws {ApiError} 400 if query is empty after sanitization
 */
export async function search(query) {
  // TODO: TASK-014 -- implement: get(`/api/search?q=${encodeURIComponent(query)}`)
  throw new Error('Not implemented');
}
