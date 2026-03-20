/**
 * TASK-004 -- useAuth Hook Tests
 *
 * Tests session check on mount, login, and logout state management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../hooks/useAuth.js';

// Mock the auth API module
vi.mock('../api/auth.js', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

// Mock the client module's get function for /api/auth/me
vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    get: vi.fn(),
  };
});

import { login as loginApi, logout as logoutApi } from '../api/auth.js';
import { get } from '../api/client.js';

describe('useAuth', () => {
  beforeEach(() => {
    loginApi.mockReset();
    logoutApi.mockReset();
    get.mockReset();
  });

  describe('initial session check on mount', () => {
    it('starts with isLoading=true before the session check completes', () => {
      // GET /api/auth/me never resolves during this test
      get.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });

    it('sets isAuthenticated=true and user when session is active', async () => {
      const mockUser = { id: '1', username: 'alice', email: 'alice@example.com' };
      get.mockResolvedValueOnce({ user: mockUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('sets isAuthenticated=false when session check returns 401', async () => {
      const { ApiError } = await import('../api/client.js');
      get.mockRejectedValueOnce(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });
  });

  describe('login()', () => {
    it('sets user and isAuthenticated=true after successful login', async () => {
      const mockUser = { id: '1', username: 'alice', email: 'alice@example.com' };
      // Session check on mount fails (unauthenticated)
      const { ApiError } = await import('../api/client.js');
      get.mockRejectedValueOnce(new ApiError(401, 'Authentication required', 'UNAUTHENTICATED'));
      // login API succeeds
      loginApi.mockResolvedValueOnce({ user: mockUser });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('alice@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(loginApi).toHaveBeenCalledWith('alice@example.com', 'password123');
    });
  });

  describe('logout()', () => {
    it('clears user and isAuthenticated=false after logout', async () => {
      const mockUser = { id: '1', username: 'alice', email: 'alice@example.com' };
      get.mockResolvedValueOnce({ user: mockUser });
      logoutApi.mockResolvedValueOnce({ message: 'Logged out' });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
      expect(logoutApi).toHaveBeenCalled();
    });
  });
});
