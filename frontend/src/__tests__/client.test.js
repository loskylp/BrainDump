/**
 * TASK-016 -- Tests for api/client.js
 * Verifies fetch wrapper sets credentials: 'include' and Content-Type: application/json.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest, ApiError } from '../api/client.js';

describe('apiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends requests with credentials: include', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiRequest('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('sends Content-Type: application/json header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    await apiRequest('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
      }),
    }));
  });

  it('JSON.stringifies request body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const body = { email: 'test@example.com', password: 'secret' };
    await apiRequest('/api/auth/login', { method: 'POST', body });

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      body: JSON.stringify(body),
    }));
  });

  it('returns parsed JSON on success', async () => {
    const responseData = { user: { id: '1', username: 'test' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseData),
    }));

    const result = await apiRequest('/api/test');
    expect(result).toEqual(responseData);
  });

  it('throws ApiError on non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ error: 'INVALID_CREDENTIALS', message: 'Bad password' }),
    }));

    await expect(apiRequest('/api/auth/login', { method: 'POST', body: {} }))
      .rejects.toThrow(ApiError);

    try {
      await apiRequest('/api/auth/login', { method: 'POST', body: {} });
    } catch (err) {
      expect(err.status).toBe(401);
      expect(err.error).toBe('INVALID_CREDENTIALS');
      expect(err.message).toBe('Bad password');
    }
  });

  it('returns null for 204 No Content responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    }));

    const result = await apiRequest('/api/auth/logout', { method: 'POST' });
    expect(result).toBeNull();
  });

  it('defaults to GET method', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    }));

    await apiRequest('/api/test');

    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'GET',
    }));
  });
});
