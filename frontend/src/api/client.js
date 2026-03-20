/**
 * HTTP client wrapper.
 *
 * Wraps the native fetch() API with consistent configuration for all
 * BrainDump API requests. All API modules (auth.js, notes.js, etc.) call
 * this module rather than fetch() directly.
 *
 * Configuration applied to every request:
 *   - credentials: 'include'       -- Send session cookie with every request
 *   - Content-Type: application/json  -- All request bodies are JSON
 *   - Automatic JSON parsing of response body
 *   - Error throwing on non-2xx responses
 *
 * Base URL:
 *   In development: empty string (Vite proxy forwards /api/* to backend:3000)
 *   In production: empty string (Express serves both frontend and /api/*)
 *   The base URL is always '' -- no environment-specific configuration needed.
 */

/**
 * Error class for non-2xx API responses.
 */
export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code
   * @param {string} message - Error message from the API
   * @param {string} error - Error code from the API
   */
  constructor(status, message, error) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
  }
}

/**
 * Sends an HTTP request to the BrainDump API.
 *
 * @param {string} path - API path starting with /api/... (e.g. '/api/notes')
 * @param {object} [options] - fetch() options (method, body, etc.)
 * @param {string} [options.method='GET'] - HTTP method
 * @param {object} [options.body] - Request body (will be JSON.stringify'd)
 * @param {object} [options.headers] - Additional headers (merged with defaults)
 * @returns {Promise<any>} Parsed JSON response body
 * @throws {ApiError} If the response status is not in the 2xx range
 *   ApiError shape: { status: number, message: string, error: string }
 *
 * @precondition path begins with /api/
 * @postcondition Session cookie is included in the request
 * @postcondition Non-2xx response rejects the promise with an ApiError
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, headers: extraHeaders, ...rest } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const fetchOptions = {
    method,
    headers,
    credentials: 'include',
    ...rest,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(path, fetchOptions);

  // Handle 204 No Content (e.g., logout)
  if (response.status === 204) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message || response.statusText,
      data?.error || 'UNKNOWN_ERROR'
    );
  }

  return data;
}

/**
 * Convenience wrappers for common HTTP methods.
 * All delegate to apiRequest() with the appropriate method set.
 */

export const get = (path) => apiRequest(path, { method: 'GET' });

export const post = (path, body) => apiRequest(path, { method: 'POST', body });

export const put = (path, body) => apiRequest(path, { method: 'PUT', body });

export const del = (path) => apiRequest(path, { method: 'DELETE' });
