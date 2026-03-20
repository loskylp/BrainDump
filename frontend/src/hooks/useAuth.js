/**
 * useAuth hook.
 *
 * Provides application-wide authentication state. Used by ProtectedRoute to
 * gate access to /workspace, and by any component that needs to know the
 * current user (e.g., to display the username in the workspace header).
 *
 * State shape:
 *   {
 *     user: { id: string, username: string, email: string } | null,
 *     isAuthenticated: boolean,
 *     isLoading: boolean,   -- true while the session check is in flight on mount
 *   }
 *
 * Behavior:
 *   - On mount: calls GET /api/auth/me to check session state
 *   - Sets isLoading=true while the request is in flight
 *   - On success: sets user and isAuthenticated=true
 *   - On 401: sets user=null and isAuthenticated=false
 *   - Exposes login(email, password) and logout() methods that update state
 *     and call the corresponding API functions
 *
 * Note: GET /api/auth/me requires a corresponding backend route (TASK-003/TASK-004
 * scope -- the Builder should add this route alongside login/logout).
 */

// TASK-004 replaces this with real session-check implementation.
// This temporary stub always returns unauthenticated state so the routing
// shell can render without crashing. ProtectedRoute will redirect to /login,
// and the landing page will render for unauthenticated visitors.

import { useState, useEffect } from 'react';

/**
 * @returns {{
 *   user: { id: string, username: string, email: string } | null,
 *   isAuthenticated: boolean,
 *   isLoading: boolean,
 *   login: (email: string, password: string) => Promise<void>,
 *   logout: () => Promise<void>,
 * }}
 */
export function useAuth() {
  // TASK-004 replaces this with real session-check implementation
  const [user] = useState(null);
  const [isLoading] = useState(false);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: async () => {},
    logout: async () => {},
  };
}
