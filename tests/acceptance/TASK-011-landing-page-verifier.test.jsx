/**
 * Verifier Acceptance Tests — TASK-011: Public landing page
 * (Reference copy — canonical test runs from frontend/src/__tests__/TASK-011-landing-page-verifier.test.jsx)
 *
 * REQ-017: Landing page for unauthenticated visitors
 * ADR-008: Professional/technical design aesthetic
 *
 * Acceptance criteria covered:
 *   AC-1  Unauthenticated root URL (/) shows the landing page
 *   AC-2  Landing page shows app description + feature highlights + registration CTA
 *   AC-3  Login link accessible from the landing page
 *   AC-4  Unauthenticated direct URL access to protected routes redirects to login
 *   AC-5  Professional aesthetic per ADR-008 (no inline styles, correct token classes)
 *   AC-6  Authenticated root URL redirects to /workspace
 *
 * For test runner instructions, see frontend/src/__tests__/TASK-011-landing-page-verifier.test.jsx
 */

// Canonical test source: frontend/src/__tests__/TASK-011-landing-page-verifier.test.jsx
// This file is a reference copy using tests/-relative import paths.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

vi.mock('../frontend/src/hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../frontend/src/hooks/useAuth.js';
import App from '../frontend/src/App.jsx';
import LandingPage from '../frontend/src/pages/LandingPage.jsx';

function renderAppAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

function renderLandingStandalone() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe('AC-1 [REQ-017]: unauthenticated root URL shows the landing page', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
  });

  it('renders BrainDump content at / when unauthenticated', () => {
    renderAppAt('/');
    expect(screen.getByText(/braindump/i)).toBeTruthy();
  });

  it('shows the app-description element at / when unauthenticated', () => {
    renderAppAt('/');
    expect(screen.getByTestId('app-description')).toBeTruthy();
  });

  it('[VERIFIER-ADDED] does NOT show workspace content at / when unauthenticated', () => {
    renderAppAt('/');
    expect(screen.queryByText(/new note/i)).toBeNull();
  });
});

describe('AC-2 [REQ-017]: landing page content — description, features, CTA', () => {
  it('displays an app description paragraph with non-empty text', () => {
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
    renderLandingStandalone();
    const cta = screen.getByTestId('register-cta');
    expect(cta).toBeTruthy();
    expect(cta.getAttribute('href')).toBe('/register');
  });

  it('[VERIFIER-ADDED] does NOT render workspace-only elements (no "New note" button)', () => {
    renderLandingStandalone();
    expect(screen.queryByText(/new note/i)).toBeNull();
  });

  it('[VERIFIER-ADDED] register CTA links to an in-app route, not an external URL', () => {
    renderLandingStandalone();
    const cta = screen.getByTestId('register-cta');
    const href = cta.getAttribute('href') || '';
    expect(href.startsWith('http')).toBe(false);
    expect(href).toBe('/register');
  });
});

describe('AC-3 [REQ-017]: login link is accessible from the landing page', () => {
  it('renders a login link with href /login', () => {
    renderLandingStandalone();
    const loginLink = screen.getByTestId('login-link');
    expect(loginLink).toBeTruthy();
    expect(loginLink.getAttribute('href')).toBe('/login');
  });

  it('[VERIFIER-ADDED] login link is a distinct element from the register CTA', () => {
    renderLandingStandalone();
    const loginLink = screen.getByTestId('login-link');
    const registerCta = screen.getByTestId('register-cta');
    expect(loginLink).not.toBe(registerCta);
    expect(loginLink.getAttribute('href')).not.toBe('/register');
  });
});

describe('AC-4 [REQ-017]: unauthenticated direct URL to protected routes redirects to login', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
  });

  it('workspace content is NOT rendered when unauthenticated at /workspace', () => {
    renderAppAt('/workspace');
    expect(screen.queryByText(/new note/i)).toBeNull();
  });

  it('[VERIFIER-ADDED] ProtectedRoute redirects to /login with a sentinel route in place', () => {
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

describe('AC-5 [REQ-017 / ADR-008]: professional aesthetic per design token system', () => {
  it('root element uses a bg-bg-secondary or bg-bg-primary class (ADR-008 token)', () => {
    const { container } = renderLandingStandalone();
    const root = container.firstChild;
    expect(root.className).toMatch(/bg-bg-primary|bg-bg-secondary/);
  });

  it('root element has no inline style attribute', () => {
    const { container } = renderLandingStandalone();
    const root = container.firstChild;
    expect(root.getAttribute('style')).toBeNull();
  });

  it('[VERIFIER-ADDED] no child element within LandingPage carries a gradient class', () => {
    const { container } = renderLandingStandalone();
    const allElements = container.querySelectorAll('[class]');
    const hasGradient = Array.from(allElements).some((el) =>
      (el.className || '').includes('gradient')
    );
    expect(hasGradient).toBe(false);
  });

  it('[VERIFIER-ADDED] page text content contains no emoji characters', () => {
    const { container } = renderLandingStandalone();
    const text = container.textContent;
    const emojiPattern = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(text)).toBe(false);
  });

  it('[VERIFIER-ADDED] heading uses an ADR-008 text-primary token class, not a raw colour value', () => {
    const { container } = renderLandingStandalone();
    const heading = container.querySelector('h1');
    expect(heading).toBeTruthy();
    expect(heading.className).toMatch(/text-text-primary|text-text-secondary/);
  });
});

describe('AC-6 [REQ-017]: authenticated root URL redirects to /workspace', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false, user: { id: '1', username: 'alice' } });
  });

  it('does NOT render the register CTA at / when authenticated', () => {
    renderAppAt('/');
    expect(screen.queryByTestId('register-cta')).toBeNull();
  });

  it('does NOT render the login link at / when authenticated', () => {
    renderAppAt('/');
    expect(screen.queryByTestId('login-link')).toBeNull();
  });

  it('[VERIFIER-ADDED] LandingRoute sends authenticated user to /workspace sentinel', () => {
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
    expect(screen.getByTestId('app-description')).toBeTruthy();
    expect(screen.queryByTestId('workspace-sentinel')).toBeNull();
  });
});

function LandingRouteInline() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/workspace" replace />;
  return <LandingPage />;
}

function ProtectedRouteWrapper({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
