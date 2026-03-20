/**
 * LandingPage component.
 *
 * The public-facing entry point for unauthenticated visitors (REQ-017).
 * Presents the product value proposition with a prominent registration CTA.
 *
 * Content requirements (TASK-011 acceptance criteria):
 *   - App description and feature highlights:
 *       "Markdown editor with live preview"
 *       "Auto-save -- never lose your work"
 *       "Full-text search across your notes"
 *       "Version history with one-click restore"
 *   - Registration CTA prominently positioned
 *   - Login link accessible from this page
 *
 * Visual spec (ADR-008):
 *   - Neutral color palette (bg-primary, text-primary)
 *   - System font stack
 *   - No decorative illustrations, gradients, or icons beyond functional ones
 *   - Professional/technical aesthetic -- not consumer-app styled
 *
 * Routing behavior:
 *   - Unauthenticated visitors see this page at /
 *   - Authenticated users navigating to / are redirected to /workspace
 *     (handled in App.jsx via useAuth check, not in this component)
 */

import React from 'react';
import { Link } from 'react-router-dom';

/** The four features surfaced on the landing page (TASK-011 AC-2). */
const FEATURE_HIGHLIGHTS = [
  {
    heading: 'Markdown editor with live preview',
    detail: 'Write in Markdown and see a rendered preview in real time, side by side.',
  },
  {
    heading: 'Auto-save — never lose your work',
    detail: 'Every keystroke is saved automatically. No manual saves, no lost drafts.',
  },
  {
    heading: 'Full-text search across your notes',
    detail: 'Find anything instantly with PostgreSQL full-text search across titles and content.',
  },
  {
    heading: 'Version history with one-click restore',
    detail: 'Every editing session creates a version. Roll back to any prior state in one click.',
  },
];

/**
 * Renders a single feature highlight row.
 *
 * @param {object} props
 * @param {string} props.heading - Short feature name
 * @param {string} props.detail - One-sentence description
 * @returns {JSX.Element}
 */
function FeatureItem({ heading, detail }) {
  return (
    <li className="py-space-md border-b border-border last:border-b-0">
      <p className="text-text-primary font-semibold text-sm">{heading}</p>
      <p className="text-text-secondary text-sm mt-space-xs">{detail}</p>
    </li>
  );
}

/**
 * Returns the public landing page for BrainDump.
 *
 * Renders without authentication. The App-level LandingRoute wrapper redirects
 * authenticated users to /workspace before this component is reached.
 *
 * @returns {JSX.Element}
 *
 * @postcondition Page renders without authentication
 * @postcondition Registration CTA links to /register
 * @postcondition Login link navigates to /login
 */
function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-secondary flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <header className="mb-space-xl">
          <h1 className="text-2xl font-semibold text-text-primary">BrainDump</h1>
          <p
            className="text-text-secondary text-sm mt-space-sm"
            data-testid="app-description"
          >
            A personal note workspace. Write in Markdown, search everything, never lose a version.
          </p>
        </header>

        {/* Feature highlights */}
        <section
          aria-label="Features"
          className="bg-bg-primary border border-border rounded mb-space-xl"
        >
          <ul className="px-space-md">
            {FEATURE_HIGHLIGHTS.map((feature) => (
              <FeatureItem
                key={feature.heading}
                heading={feature.heading}
                detail={feature.detail}
              />
            ))}
          </ul>
        </section>

        {/* Registration CTA */}
        <div className="flex flex-col items-start gap-space-sm">
          <Link
            to="/register"
            data-testid="register-cta"
            className="inline-block bg-accent hover:bg-accent-hover text-white text-sm font-semibold px-space-md py-space-sm rounded"
          >
            Create your free account
          </Link>

          <p className="text-text-secondary text-sm">
            Already have an account?{' '}
            <Link
              to="/login"
              data-testid="login-link"
              className="text-accent hover:text-accent-hover underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
