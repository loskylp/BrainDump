# Demo Script -- TASK-016: Workspace layout shell and routing
**Date:** 2026-03-19
**Task:** TASK-016
**Requirements:** REQ-007, REQ-008, REQ-017
**Profile:** Commercial

Run these scenarios in the staging environment from the project base directory. Each scenario maps directly to a passing acceptance test. Prerequisites: the frontend dev server is running (`npm run dev` from `frontend/`) and is accessible at `http://localhost:5173`.

---

## Scenario 1 -- Root route shows landing page for unauthenticated visitor
**Acceptance criterion 1 (unauthenticated branch)**

Given   the user is not logged in (no active session)
When    the user navigates to `http://localhost:5173/`
Then    the landing page is displayed (not the workspace)
        the URL remains `/`
        no redirect to `/workspace` occurs

---

## Scenario 2 -- Root route redirects authenticated user to workspace
**Acceptance criterion 1 (authenticated branch)**

Given   the user is logged in (active session present)
When    the user navigates to `http://localhost:5173/`
Then    the browser is redirected to `/workspace`
        the workspace layout is displayed

---

## Scenario 3 -- Workspace route is protected; unauthenticated access redirects to login
**Acceptance criterion 2**

Given   the user is not logged in
When    the user navigates directly to `http://localhost:5173/workspace`
Then    the browser is redirected to `/login`
        the workspace is not rendered
        no workspace content is visible before or after the redirect

---

## Scenario 4 -- Workspace layout displays the three-panel CSS Grid
**Acceptance criteria 3 and 4**

Given   the user is logged in
When    the user is on the workspace at `http://localhost:5173/workspace`
        and the browser viewport is set to 1920px wide
Then    three panels are visible side-by-side: sidebar (left), editor (centre), preview (right)
        the sidebar occupies a fixed 260px column
        the editor and preview each occupy half of the remaining space (1fr each)
        no panel is hidden, collapsed, or overflowing
        no horizontal scrollbar is present

To inspect the grid declaration: open browser DevTools, select the workspace container element, and confirm `grid-template-columns: 260px 1fr 1fr` in the Computed styles panel.

---

## Scenario 5 -- Tailwind design tokens are present in the config (color, typography, spacing)
**Acceptance criterion 5**

Given   the project's `frontend/tailwind.config.js`
When    the file is inspected
Then    the following color tokens are present under `theme.extend.colors` with the exact hex values from ADR-008:
        `bg-primary (#FFFFFF)`, `bg-secondary (#F8F9FA)`, `bg-tertiary (#E9ECEF)`, `bg-editor (#1E1E1E)`,
        `text-primary (#212529)`, `text-secondary (#6C757D)`, `text-muted (#ADB5BD)`,
        `accent (#0D6EFD)`, `accent-hover (#0B5ED7)`, `border (#DEE2E6)`,
        `success (#198754)`, `error (#DC3545)`, `warning (#FFC107)`
        the `sans` font family includes `-apple-system` and `Roboto`
        the `mono` font family includes `JetBrains Mono` and `Consolas`
        the following spacing tokens are present under `theme.extend.spacing`:
        `space-xs (4px)`, `space-sm (8px)`, `space-md (16px)`, `space-lg (24px)`, `space-xl (32px)`

Run `npm test` from `frontend/` to confirm all 43 assertions pass, including the `spacing tokens` describe block.

---

## Scenario 6 -- tailwind.config.js contains the complete locked design token system
**Acceptance criterion 6**

Given   the project's `frontend/tailwind.config.js`
When    the file is compared against ADR-008
Then    all three token categories are fully populated: 13 color tokens, 2 font families, 5 spacing tokens
        border radius is capped at 4px for all scale keys (DEFAULT, sm, md, lg, xl, 2xl, 3xl)
        the `full` border radius key is present (permitted for functional uses per ADR-008)
        no token from ADR-008 is absent or carries an incorrect value

The automated evidence is the `tailwind-tokens.test.js` suite (23 assertions, all passing).
