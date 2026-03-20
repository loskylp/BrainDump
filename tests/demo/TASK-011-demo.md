# Demo Script — TASK-011: Public landing page

**Task:** TASK-011
**Date:** 2026-03-20
**Environment:** Staging — https://braindump.staging.nxlabs.cc

---

## Prerequisites

- Staging environment is running and reachable
- At least one registered user account exists (for AC-6 scenario)
- You are not currently logged in (clear cookies or use a private window for unauthenticated scenarios)

---

## Scenario 1 — Unauthenticated visitor sees the landing page (AC-1, AC-2, AC-3)

Given   | An unauthenticated visitor (no session cookie) opens a private browser window
When    | The visitor navigates to the root URL: `https://braindump.staging.nxlabs.cc/`
Then    | The landing page renders — **verify each of the following is visible:**

- Product name: **BrainDump** (as a page heading)
- App description paragraph (below the heading)
- Feature highlights section containing all four items:
  - Markdown editor with live preview
  - Auto-save — never lose your work
  - Full-text search across your notes
  - Version history with one-click restore
- A prominent **"Create your free account"** button/link
- A secondary line reading **"Already have an account? Log in"** with a login link

---

## Scenario 2 — Registration CTA links to the registration page (AC-2)

Given   | The landing page is visible (from Scenario 1)
When    | The Nexus clicks the **"Create your free account"** button
Then    | The browser navigates to `https://braindump.staging.nxlabs.cc/register`
And     | The registration form is displayed

---

## Scenario 3 — Login link is accessible from the landing page (AC-3)

Given   | The landing page is visible (from Scenario 1)
When    | The Nexus clicks the **"Log in"** link
Then    | The browser navigates to `https://braindump.staging.nxlabs.cc/login`
And     | The login form is displayed

---

## Scenario 4 — Unauthenticated direct URL to /workspace redirects (AC-4)

Given   | The Nexus is not logged in (no session cookie)
When    | The Nexus navigates directly to `https://braindump.staging.nxlabs.cc/workspace`
Then    | The browser redirects to the login page (`/login`)
And     | The workspace content is not visible

---

## Scenario 5 — Professional aesthetic check (AC-5)

Given   | The landing page is visible (from Scenario 1)
When    | The Nexus inspects the visual design
Then    | **Verify all of the following:**

- Background colour is a neutral light grey or white — no coloured or gradient backgrounds
- Typography is a system sans-serif font — not a decorative or handwritten font
- No emoji, illustrations, or decorative icons are present
- No pill-shaped or overly rounded elements (corners are sharp or minimally rounded)
- No box shadows heavier than a subtle 1px border
- The colour palette is limited to neutral greys, near-white, and the accent blue (`#0D6EFD`) used only for the CTA and login link

---

## Scenario 6 — Authenticated user is redirected to workspace (AC-6)

Given   | The Nexus is logged in with a valid session (log in via `/login` if needed)
When    | The Nexus navigates to the root URL: `https://braindump.staging.nxlabs.cc/`
Then    | The browser redirects immediately to `/workspace`
And     | The landing page content (product description, "Create your free account" button) is NOT visible
And     | The workspace is displayed

---

## Pass criteria

All six scenarios must produce the described outcomes with no errors or unexpected redirects.
