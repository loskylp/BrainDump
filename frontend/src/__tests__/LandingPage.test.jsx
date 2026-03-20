/**
 * Unit tests for LandingPage (TASK-011).
 *
 * Acceptance criteria covered:
 *   AC-2  Landing page shows app description, feature highlights, and a
 *         registration CTA prominently positioned
 *   AC-3  Login link is accessible from the landing page
 *   AC-5  Professional aesthetic per ADR-008 (bg-bg-primary, text-text-primary,
 *         accent colour classes; no inline styles)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage.jsx';

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  describe('AC-2: app description and content', () => {
    it('renders the BrainDump product name', () => {
      renderLanding();
      expect(screen.getByText(/braindump/i)).toBeTruthy();
    });

    it('renders a product description', () => {
      renderLanding();
      // Any description text that conveys the product purpose
      expect(screen.getByTestId('app-description')).toBeTruthy();
    });

    it('renders feature highlight: Markdown editor with live preview', () => {
      renderLanding();
      expect(screen.getByText(/markdown editor/i)).toBeTruthy();
    });

    it('renders feature highlight: auto-save', () => {
      renderLanding();
      expect(screen.getByText(/auto.?save/i)).toBeTruthy();
    });

    it('renders feature highlight: full-text search', () => {
      renderLanding();
      // The phrase appears in both the heading and detail text, so getAllByText is used.
      const matches = screen.getAllByText(/full.?text search/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('renders feature highlight: version history', () => {
      renderLanding();
      expect(screen.getByText(/version history/i)).toBeTruthy();
    });

    it('renders a registration CTA link pointing to /register', () => {
      renderLanding();
      const cta = screen.getByTestId('register-cta');
      expect(cta).toBeTruthy();
      expect(cta.getAttribute('href')).toBe('/register');
    });
  });

  describe('AC-3: login link accessibility', () => {
    it('renders a link to the login page', () => {
      renderLanding();
      const loginLink = screen.getByTestId('login-link');
      expect(loginLink).toBeTruthy();
      expect(loginLink.getAttribute('href')).toBe('/login');
    });
  });

  describe('AC-5: professional aesthetic (ADR-008)', () => {
    it('uses bg-bg-primary or bg-bg-secondary class for the page background', () => {
      const { container } = renderLanding();
      const root = container.firstChild;
      expect(root.className).toMatch(/bg-bg-primary|bg-bg-secondary/);
    });

    it('renders no inline style attributes on the root element', () => {
      const { container } = renderLanding();
      const root = container.firstChild;
      expect(root.getAttribute('style')).toBeNull();
    });
  });
});
