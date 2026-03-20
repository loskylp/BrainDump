# Handoff Note — TASK-011: Public landing page (iteration 1)
**Iteration:** 1 of 3
**Date:** 2026-03-20
**Builder:** Claude Sonnet 4.6
**Status:** All 6 acceptance criteria satisfied — all tests pass

---

## What was built

### Prior state of the codebase

Before this iteration, the scaffolding for TASK-011 was already partially in place:

- `frontend/src/App.jsx` — fully implemented `LandingRoute` wrapper that reads `useAuth` and redirects authenticated users to `/workspace`, or renders `<LandingPage />` for unauthenticated visitors. This satisfies AC-1 and AC-6 without any changes in this iteration.
- `frontend/src/components/common/ProtectedRoute.jsx` — fully implemented, redirecting unauthenticated direct URL access to `/login`. This satisfies AC-4 without any changes in this iteration.
- `frontend/src/pages/LandingPage.jsx` — scaffold stub returning `null` with content contracts and postcondition documentation in place.

The only implementation work required was completing `LandingPage.jsx`.

### LandingPage implementation

**`frontend/src/pages/LandingPage.jsx`**

The stub was replaced with a complete implementation. The structure:

1. **`FEATURE_HIGHLIGHTS` constant** — array of four `{ heading, detail }` objects lifted out of the render tree. The four features match the task spec exactly: Markdown editor with live preview, Auto-save, Full-text search, Version history.

2. **`FeatureItem` function component** — Extract Function applied to the feature list row. Accepts `heading` and `detail` props. Renders a `<li>` with the heading in `text-text-primary font-semibold` and the detail in `text-text-secondary`. All spacing uses ADR-008 design tokens (`py-space-md`, `mt-space-xs`).

3. **`LandingPage` function component** — page root. Structure:
   - Full-height `bg-bg-secondary` container (no inline styles)
   - Centred `max-w-2xl` column
   - `<header>` with `BrainDump` heading and `data-testid="app-description"` description
   - `<section aria-label="Features">` containing the four `FeatureItem` rows in a white card on `bg-bg-primary` with `border-border`
   - CTA block: `<Link to="/register" data-testid="register-cta">` as the primary action; `<Link to="/login" data-testid="login-link">` in the secondary line

All Tailwind classes are from the ADR-008 token system. No inline styles, no gradients, no shadows heavier than a 1px border, no rounded corners above 4px (`rounded` = 4px in the project's Tailwind config), no decorative elements.

---

## Test counts

| Suite | Before (start of iter) | After (end of iter) |
|---|---|---|
| Frontend unit tests (Vitest) | 130 passed | 140 passed |

---

## New test files

- `frontend/src/__tests__/LandingPage.test.jsx` — 10 tests across three describe blocks:
  - AC-2 (7 tests): product name, app description, Markdown editor feature, auto-save feature, full-text search feature, version history feature, register CTA href
  - AC-3 (1 test): login link presence and href
  - AC-5 (2 tests): root element uses a bg-bg-primary or bg-bg-secondary class, root element has no inline style attribute

---

## Acceptance criteria coverage

| AC | Status | Notes |
|---|---|---|
| AC-1: Unauthenticated root URL shows landing page | SATISFIED | `LandingRoute` in `App.jsx` was already implemented; confirmed passing via `App.test.jsx` |
| AC-2: App description, feature highlights, registration CTA | SATISFIED | All four features rendered; CTA links to `/register` |
| AC-3: Login link accessible from landing page | SATISFIED | `data-testid="login-link"` anchor linking to `/login` |
| AC-4: Unauthenticated direct URL access redirects to login | SATISFIED | `ProtectedRoute.jsx` was already implemented; confirmed passing via `ProtectedRoute.test.jsx` |
| AC-5: Professional aesthetic per ADR-008 | SATISFIED | Neutral palette tokens only; no inline styles, no gradients, no decorative elements; unit tests verify class names and absence of inline styles |
| AC-6: Authenticated root URL redirects to /workspace | SATISFIED | `LandingRoute` in `App.jsx` was already implemented; confirmed by `ProtectedRoute.test.jsx` and `App.test.jsx` |

---

## Deviations from task description

None. AC-1, AC-4, and AC-6 were found to be already fully satisfied by prior scaffolding (`App.jsx` and `ProtectedRoute.jsx`). No changes to those files were needed or made.

---

## Known limitations

1. **Landing page is not responsive below 768px.** The page uses a fixed-width centred column. On very narrow viewports the text and CTA are still readable but the layout has not been optimised per ADR-009 breakpoints. ADR-009 responsive design is scoped to the three-panel workspace (TASK-016) — the landing page's narrow-viewport behaviour is not explicitly specified in TASK-011 and has not been addressed here.

2. **No loading state.** The `LandingRoute` wrapper in `App.jsx` returns `null` while `useAuth.isLoading` is true. This means the landing page briefly shows nothing during the initial session check. This behaviour is pre-existing (set by the scaffold) and consistent with how `ProtectedRoute` handles loading.

---

## Files changed

**New files:**
- `frontend/src/__tests__/LandingPage.test.jsx`

**Modified files:**
- `frontend/src/pages/LandingPage.jsx` — stub replaced with full implementation
