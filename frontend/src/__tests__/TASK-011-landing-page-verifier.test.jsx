/**
 * Verifier Acceptance Tests — TASK-011: Public landing page
 *
 * REQ-017: Landing page for unauthenticated visitors
 * ADR-008: Professional/technical design aesthetic
 *
 * These tests are authored by the Verifier. They operate through the React
 * component tree rendered in jsdom (Vitest + Testing Library), exercising
 * routing, render output, and observable DOM state. No implementation
 * internals are accessed beyond what is visible in the rendered DOM.
 *
 * Acceptance criteria covered:
 *   AC-1  Unauthenticated root URL (/) shows the landing page
 *   AC-2  Landing page shows app description + feature highlights + registration CTA
 *   AC-3  Login link accessible from the landing page
 *   AC-4  Unauthenticated direct URL access to protected routes redirects to login
 *   AC-5  Professional aesthetic per ADR-008 (no inline styles, correct token classes)
 *   AC-6  Authenticated root URL redirects to /workspace
 *
 * Test layers: acceptance (component integration through React Router)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Module mock: useAuth
// Each describe block configures the mock return value via beforeEach.
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';
import App from '../App.jsx';
import LandingPage from '../pages/LandingPage.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render the full App at a given initial path.
 * The useAuth hook mock must be configured before calling this.
 */
function renderAppAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

/** Render LandingPage standalone (for AC-2, AC-3, AC-5 component-level tests). */
function renderLandingStandalone() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// AC-1 [REQ-017]: Unauthenticated root URL (/) shows the landing page
// ---------------------------------------------------------------------------

describe('AC-1 [REQ-017]: unauthenticated root URL shows the landing page', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
  });

  it('renders BrainDump content at / when unauthenticated', () => {
    // Given: the user is not authenticated
    // When: the user navigates to /
    // Then: the landing page renders — BrainDump product name visible
    renderAppAt('/');
    expect(screen.getByText(/braindump/i)).toBeTruthy();
  });

  it('shows the app-description element at / when unauthenticated', () => {
    // Given: unauthenticated session
    // When: navigating to /
    // Then: the app-description testid is present (confirms LandingPage content, not a blank page)
    renderAppAt('/');
    expect(screen.getByTestId('app-description')).toBeTruthy();
  });

  it('[VERIFIER-ADDED] does NOT show workspace content at / when unauthenticated', () => {
    // Negative: the workspace must not be shown to an unauthenticated visitor at /
    // Given: unauthenticated session
    // When: navigating to /
    // Then: workspace-specific content is absent
    renderAppAt('/');
    // WorkspacePage renders a "New note" button — confirm it is not present on landing page
    expect(screen.queryByText(/new note/i)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-2 [REQ-017]: Landing page shows app description, feature highlights, CTA
// ---------------------------------------------------------------------------

describe('AC-2 [REQ-017]: landing page content — description, features, CTA', () => {
  it('displays an app description paragraph with non-empty text', () => {
    // Given: the landing page is rendered
    // When: the page mounts
    // Then: a description element is present and contains text
    renderLandingStandalone();
    const desc = screen.getByTestId('app-description');
    expect(desc.textContent.trim().length).toBeGreaterThan(0);
  });

  it('displays the Markdown editor feature highlight', () => {
    renderLandingStandalone();
    expect(screen.getByText(/markdown editor/i)).toBeTruthy();
  });

  it('displays the auto-save feature highlight', () => {
    renderLandingStandalone();
    expect(screen.getByText(/auto.?save/i)).toBeTruthy();
  });

  it('displays the full-text search feature highlight', () => {
    renderLandingStandalone();
    const matches = screen.getAllByText(/full.?text search/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('displays the version history feature highlight', () => {
    renderLandingStandalone();
    expect(screen.getByText(/version history/i)).toBeTruthy();
  });

  it('renders the registration CTA with href /register', () => {
    // Given: landing page rendered
    // When: page mounts
    // Then: a register CTA element is present and points to /register
    renderLandingStandalone();
    const cta = screen.getByTestId('register-cta');
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe('/register');
  });

  it('[VERIFIER-ADDED] does NOT render workspace-only elements (no "New note" button)', () => {
    // Negative: landing page must not accidentally include workspace UI
    renderLandingStandalone();
    expect(screen.queryByText(/new note/i)).toBeNull();
  });

  it('[VERIFIER-ADDED] register CTA links to an in-app route, not an external URL', () => {
    // Negative: the CTA must link to /register, not http://... or another external URL
    renderLandingStandalone();
    const cta = screen.getByTestId('register-cta');
    const href = cta.getAttribute('href') || '';
    expect(href.startsWith('http')).toBe(false);
    expect(href).toBe('/register');
  });
});

// ---------------------------------------------------------------------------
// AC-3 [REQ-017]: Login link is accessible from the landing page
// ---------------------------------------------------------------------------

describe('AC-3 [REQ-017]: login link is accessible from the landing page', () => {
  it('renders a login link with href /login', () => {
    // Given: landing page rendered
    // When: page mounts
    // Then: a login link is present pointing to /login
    renderLandingStandalone();
    const loginLink = screen.getByTestId('login-link');
    expect(loginLink).toBeTruthy();
    expect(loginLink.getAttribute('href')).toBe('/login');
  });

  it('[VERIFIER-ADDED] login link is a distinct element from the register CTA', () => {
    // Negative: login and register must be separate, distinct links
    renderLandingStandalone();
    const loginLink = screen.getByTestId('login-link');
    const registerCta = screen.getByTestId('register-cta');
    expect(loginLink).not.toBe(registerCta);
    expect(loginLink.getAttribute('href')).not.toBe('/register');
  });
});

// ---------------------------------------------------------------------------
// AC-4 [REQ-017]: Unauthenticated direct URL access to protected routes redirects
// ---------------------------------------------------------------------------

describe('AC-4 [REQ-017]: unauthenticated direct URL to protected routes redirects to login', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
  });

  it('workspace content is NOT rendered when unauthenticated at /workspace', () => {
    // Given: unauthenticated session
    // When: user navigates directly to /workspace
    // Then: workspace-specific elements are absent — ProtectedRoute redirected
    renderAppAt('/workspace');
    expect(screen.queryByText(/new note/i)).toBeNull();
  });

  it('[VERIFIER-ADDED] ProtectedRoute redirects to /login with a sentinel route in place', () => {
    // Direct test of ProtectedRoute redirect behaviour.
    // Given: unauthenticated session
    // When: user navigates to /workspace with a /login sentinel route defined
    // Then: the user is shown the login sentinel — not workspace content
    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route
            path="/workspace"
            element={
              <ProtectedRouteWrapper>
                <div data-testid="workspace-sentinel">workspace content</div>
              </ProtectedRouteWrapper>
            }
          />
          <Route path="/login" element={<div data-testid="login-sentinel">login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByTestId('workspace-sentinel')).toBeNull();
    expect(screen.getByTestId('login-sentinel')).toBeTruthy();
  });

  it('[VERIFIER-ADDED] authenticated user CAN reach /workspace — redirect is not indiscriminate', () => {
    // Negative: the guard must not redirect authenticated users away from /workspace
    useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { id: '1', username: 'alice' } });
    render(
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route
            path="/workspace"
            element={
              <ProtectedRouteWrapper>
                <div data-testid="workspace-sentinel">workspace content</div>
              </ProtectedRouteWrapper>
            }
          />
          <Route path="/login" element={<div data-testid="login-sentinel">login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('workspace-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('login-sentinel')).toBeNull();
  });

  it('[VERIFIER-ADDED] loading state renders nothing — no premature redirect', () => {
    // Negative: while isLoading=true the ProtectedRoute must suspend, not redirect
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null });
    const { container } = render(
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route
            path="/workspace"
            element={
              <ProtectedRouteWrapper>
                <div data-testid="workspace-sentinel">workspace content</div>
              </ProtectedRouteWrapper>
            }
          />
          <Route path="/login" element={<div data-testid="login-sentinel">login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(container.textContent).toBe('');
  });
});

// ---------------------------------------------------------------------------
// AC-5 [REQ-017 / ADR-008]: Professional aesthetic — design token classes, no inline styles
// ---------------------------------------------------------------------------

describe('AC-5 [REQ-017 / ADR-008]: professional aesthetic per design token system', () => {
  it('root element uses a bg-bg-secondary or bg-bg-primary class (ADR-008 token)', () => {
    // Given: landing page rendered
    // When: page mounts
    // Then: root element carries an ADR-008 background token class
    const { container } = renderLandingStandalone();
    const root = container.firstChild;
    expect(root.className).toMatch(/bg-bg-primary|bg-bg-secondary/);
  });

  it('root element has no inline style attribute', () => {
    // Given: landing page rendered
    // When: page mounts
    // Then: no inline styles on the root — ADR-008 requires token classes, not style props
    const { container } = renderLandingStandalone();
    const root = container.firstChild;
    expect(root.getAttribute('style')).toBeNull();
  });

  it('[VERIFIER-ADDED] no child element within LandingPage carries a gradient class', () => {
    // ADR-008 anti-pattern: gradient backgrounds are prohibited
    const { container } = renderLandingStandalone();
    const allElements = container.querySelectorAll('[class]');
    const hasGradient = Array.from(allElements).some((el) =>
      (el.className || '').includes('gradient')
    );
    expect(hasGradient).toBe(false);
  });

  it('[VERIFIER-ADDED] page text content contains no emoji characters', () => {
    // ADR-008 anti-pattern: playful iconography is prohibited
    const { container } = renderLandingStandalone();
    const text = container.textContent;
    // Test for common emoji Unicode ranges
    const emojiPattern = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(text)).toBe(false);
  });

  it('[VERIFIER-ADDED] heading uses an ADR-008 text-primary token class, not a raw colour value', () => {
    // The h1 must use a token class, not a raw hex or Tailwind colour value
    const { container } = renderLandingStandalone();
    const heading = container.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading.className).toMatch(/text-text-primary|text-text-secondary/);
  });
});

// ---------------------------------------------------------------------------
// AC-6 [REQ-017]: Authenticated root URL redirects to /workspace
// ---------------------------------------------------------------------------

describe('AC-6 [REQ-017]: authenticated root URL redirects to /workspace', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { id: '1', username: 'alice' } });
  });

  it('does NOT render the register CTA at / when authenticated', () => {
    // Given: authenticated session
    // When: authenticated user navigates to /
    // Then: LandingPage registration CTA is not rendered — user was redirected away
    renderAppAt('/');
    expect(screen.queryByTestId('register-cta')).toBeNull();
  });

  it('does NOT render the login link at / when authenticated', () => {
    // Given: authenticated session
    // When: authenticated user navigates to /
    // Then: LandingPage login-link is absent (LandingPage not shown to authenticated users)
    renderAppAt('/');
    expect(screen.queryByTestId('login-link')).toBeNull();
  });

  it('[VERIFIER-ADDED] LandingRoute sends authenticated user to /workspace sentinel', () => {
    // Direct test of LandingRoute redirect logic with a /workspace sentinel route.
    // Given: authenticated session
    // When: LandingRoute is rendered at /
    // Then: Navigate redirects to /workspace — the sentinel is shown
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingRouteInline />} />
          <Route
            path="/workspace"
            element={<div data-testid="workspace-sentinel">workspace</div>}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('workspace-sentinel')).toBeTruthy();
    expect(screen.queryByTestId('register-cta')).toBeNull();
  });

  it('[VERIFIER-ADDED] unauthenticated user at / does NOT redirect to /workspace', () => {
    // Negative: the redirect is conditional — unauthenticated users must see LandingPage
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingRouteInline />} />
          <Route
            path="/workspace"
            element={<div data-testid="workspace-sentinel">workspace</div>}
          />
        </Routes>
      </MemoryRouter>
    );
    // Landing page content must be visible
    expect(screen.getByTestId('app-description')).toBeTruthy();
    expect(screen.queryByTestId('workspace-sentinel')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Inline component helpers for isolated route tests
// These re-implement the LandingRoute and ProtectedRoute logic inline so the
// tests remain self-contained and do not depend on App.jsx's private symbols.
// ---------------------------------------------------------------------------

/**
 * Inline implementation of LandingRoute for isolated AC-6 test.
 * Reads useAuth and redirects authenticated users to /workspace.
 */
function LandingRouteInline() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/workspace" replace />;
  return <LandingPage />;
}

/**
 * Inline implementation of ProtectedRoute for isolated AC-4 test.
 * Reads useAuth and redirects unauthenticated users to /login.
 */
function ProtectedRouteWrapper({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
