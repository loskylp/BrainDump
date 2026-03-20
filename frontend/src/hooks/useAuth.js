/**
 * useAuth hook.
 *
 * Provides application-wide authentication state. Checks the active session
 * via GET /api/auth/me on mount, then exposes login() and logout() methods
 * that update state and call the corresponding API functions.
 *
 * State shape:
 *   {
 *     user: { id: string, username: string, email: string } | null,
 *     isAuthenticated: boolean,
 *     isLoading: boolean,  -- true while the initial session check is in flight
 *   }
 *
 * On mount:
 *   - Calls GET /api/auth/me with credentials: 'include' (session cookie sent)
 *   - Sets isLoading=true while the request is in flight
 *   - On success: sets user and isAuthenticated=true
 *   - On 401 or any error: sets user=null and isAuthenticated=false
 *
 * login(email, password):
 *   - Calls POST /api/auth/login via the auth API module
 *   - On success: updates user and isAuthenticated=true
 *   - Propagates errors to the caller (LoginForm handles display)
 *
 * logout():
 *   - Calls POST /api/auth/logout via the auth API module
 *   - On completion: clears user and isAuthenticated=false
 *   - Propagates errors to the caller
 */

import { useState, useEffect } from 'react';
import { get } from '../api/client.js';
import { login as loginApi, logout as logoutApi } from '../api/auth.js';

/**
 * Returns authentication state and auth action functions.
 *
 * @returns {{
 *   user: { id: string, username: string, email: string } | null,
 *   isAuthenticated: boolean,
 *   isLoading: boolean,
 *   login: (email: string, password: string) => Promise<void>,
 *   logout: () => Promise<void>,
 * }}
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const data = await get('/api/auth/me');
        if (!cancelled) {
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Authenticates the user and updates the local auth state.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   * @throws {ApiError} If credentials are invalid or the request fails
   */
  async function login(email, password) {
    const data = await loginApi(email, password);
    setUser(data.user);
  }

  /**
   * Destroys the server session and clears local auth state.
   *
   * @returns {Promise<void>}
   * @throws {ApiError} If the logout request fails
   */
  async function logout() {
    await logoutApi();
    setUser(null);
  }

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };
}
