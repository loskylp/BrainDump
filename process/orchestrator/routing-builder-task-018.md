# Routing Instruction -- Builder
**Task:** TASK-018 | **Iteration:** 1 of 3
**Date:** 2026-03-21 | **From:** Orchestrator | **To:** Builder

---

## Context

TASK-018 implements responsive design for tablet and mobile breakpoints (REQ-013, ADR-009). This is the sixth task in Cycle 2. The workspace currently uses a fixed 3-column CSS Grid (`260px 1fr 1fr`) that only works at desktop widths.

The current layout lives in `frontend/src/components/layout/WorkspaceLayout.jsx`. It renders three children (sidebar, editor, preview) in an inline `style={{ display: 'grid', gridTemplateColumns: '260px 1fr 1fr' }}`. This inline style must be replaced with Tailwind responsive classes to enable breakpoint-driven layout changes.

A `HamburgerToggle` component stub exists at `frontend/src/components/common/HamburgerToggle.jsx` with props `{ isOpen, onToggle }` and detailed JSDoc describing the expected behavior. It currently throws "Not implemented".

**Tailwind config:** The project uses a locked design token system in `frontend/tailwind.config.js` (ADR-008). The file is frozen -- do not modify it. Use existing Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) and the existing color/spacing tokens. Tailwind's default breakpoints apply: `sm` = 640px, `md` = 768px, `lg` = 1024px.

**Standing observation:** OBS-V007-02 (prose-preview Tailwind class used in Preview but not defined in tailwind.config.js) -- address if practical while touching responsive styles.

## What to Build

The goal is a progressively responsive workspace that adapts across three breakpoint tiers without breaking the existing desktop layout.

### Breakpoint Tiers

| Viewport | Behavior |
|---|---|
| >= 1024px (desktop) | Current layout: sidebar + editor + preview, all visible. 260px sidebar, 1fr editor, 1fr preview. No hamburger toggle. |
| 768px-1023px (tablet) | Sidebar hidden by default. Hamburger toggle (top-left) slides sidebar in as a fixed overlay from the left with 0.2s CSS transition. Editor + preview visible side by side (1fr 1fr). |
| < 768px (mobile) | Single panel visible at a time. Tab bar at the top with "Notes", "Edit", "Preview" labels for panel switching. No split view. |

### Step 1: Implement `HamburgerToggle` component

**File:** `frontend/src/components/common/HamburgerToggle.jsx`

Replace the stub. This is a toggle button for the sidebar on sub-desktop viewports:

- Render a `<button>` with a hamburger icon (three horizontal bars) when `isOpen` is false, and an X (close) icon when `isOpen` is true. Use simple CSS/SVG for the icon -- no icon library needed.
- `aria-label`: "Toggle sidebar" when closed, "Close sidebar" when open
- `aria-expanded={isOpen}`
- Minimum 44px touch target: use Tailwind `h-11 w-11` or equivalent (AC-5)
- On desktop (>= 1024px): hidden via `lg:hidden` Tailwind class
- On sub-desktop: visible, positioned by the parent layout
- `onClick` calls `onToggle()`
- Style: `bg-bg-secondary border border-border` for consistency with sidebar aesthetic

### Step 2: Refactor `WorkspaceLayout` for responsive behavior

**File:** `frontend/src/components/layout/WorkspaceLayout.jsx`

This is the main layout change. The component needs new props and responsive rendering:

**New props:**
- `sidebarOpen` (boolean) -- whether the sidebar overlay is visible on tablet
- `onSidebarClose` (function) -- called when the sidebar overlay should close (clicking outside, pressing Escape)
- `activePanel` (string: 'sidebar' | 'editor' | 'preview') -- which panel is visible on mobile
- `onPanelChange` (function) -- callback for mobile tab bar panel switching

**Desktop (>= 1024px):**
- Replace the inline `style={{ display: 'grid', gridTemplateColumns: '260px 1fr 1fr' }}` with Tailwind classes
- Since Tailwind cannot express `260px 1fr 1fr` directly, use a custom approach: keep the inline grid-template-columns for desktop but conditionally apply it only at lg and above. Alternatively, use Tailwind's `lg:grid lg:grid-cols-[260px_1fr_1fr]` arbitrary value syntax (preferred -- this is standard Tailwind).
- All three panels visible simultaneously

**Tablet (768px-1023px):**
- Two-column layout: `md:grid md:grid-cols-2` (editor + preview, each 1fr)
- Sidebar rendered as a fixed overlay: `fixed top-0 left-0 h-full w-[260px] z-40` with `bg-bg-secondary`
- Overlay slides in from the left: use `transform -translate-x-full` when closed, `translate-x-0` when open, with `transition-transform duration-200` (0.2s per AC-3)
- Semi-transparent backdrop behind the overlay (e.g., `fixed inset-0 bg-black/30 z-30`) -- clicking it calls `onSidebarClose`
- `HamburgerToggle` rendered by the parent (WorkspacePage), not by WorkspaceLayout

**Mobile (< 768px):**
- Single panel: only the `activePanel` content is rendered/visible
- Tab bar at top with three tabs: "Notes", "Edit", "Preview" (clear labels per AC-6)
- Tab bar uses `text-sm font-sans` with active tab highlighted using `border-b-2 border-accent text-accent` and inactive tabs using `text-text-secondary`
- Tab bar touch targets: minimum 44px height per AC-5 (`h-11`)
- Below the tab bar, render only the active panel
- The tab bar is rendered inside WorkspaceLayout at `md:hidden` (visible only below 768px)

**Important:** Existing desktop tests check `gridTemplateColumns === '260px 1fr 1fr'`. If you switch to Tailwind arbitrary values (`grid-cols-[260px_1fr_1fr]`), the existing tests that inspect `element.style.gridTemplateColumns` will need updating because Tailwind generates CSS classes rather than inline styles. Update these tests to check for the correct Tailwind class presence instead, or keep the inline style conditionally at desktop. Choose whichever approach results in cleaner code -- but ensure all existing desktop tests still pass.

### Step 3: Wire responsive state in `WorkspacePage`

**File:** `frontend/src/pages/WorkspacePage.jsx`

Add responsive state management:

1. **New state:**
   - `sidebarOpen` (boolean, default false) -- controls sidebar overlay on tablet
   - `activePanel` (string, default 'editor') -- which panel is visible on mobile

2. **Handlers:**
   - `handleSidebarToggle`: toggle `sidebarOpen`
   - `handleSidebarClose`: set `sidebarOpen` to false
   - `handlePanelChange(panel)`: set `activePanel` to the selected panel

3. **Render the HamburgerToggle:** Position it in the workspace header area or as a floating button, visible only on sub-desktop. Pass `isOpen={sidebarOpen}` and `onToggle={handleSidebarToggle}`.

4. **Pass new props to WorkspaceLayout:** `sidebarOpen`, `onSidebarClose`, `activePanel`, `onPanelChange`

5. **Mobile note selection:** When a note is selected in the sidebar on mobile, automatically switch `activePanel` to 'editor' so the user sees the note content.

6. **Escape key:** Close sidebar overlay when Escape is pressed on tablet viewports.

### Step 4: Ensure no horizontal scrollbar (AC-4)

- Add `overflow-x-hidden` to the root layout container if not already present
- Test at 375px, 768px, 1024px, and 1920px viewport widths
- Ensure no element exceeds 100vw at any breakpoint

### Step 5: Tests

#### Frontend component tests (`frontend/src/__tests__/HamburgerToggle.test.jsx`):
- Renders a button with aria-label "Toggle sidebar" when closed
- Renders a button with aria-label "Close sidebar" when open
- Has `aria-expanded` matching isOpen prop
- Calls onToggle when clicked
- Has minimum 44px touch target (check for h-11 w-11 or min-h/min-w classes)
- Has `lg:hidden` class (hidden on desktop)

#### Frontend component tests (`frontend/src/__tests__/WorkspaceLayout.responsive.test.jsx`):
- Desktop: all three panels rendered simultaneously
- Desktop: grid layout has three columns (260px sidebar, 1fr editor, 1fr preview)
- Tablet: sidebar overlay uses fixed positioning
- Tablet: sidebar overlay has 0.2s transition
- Tablet: backdrop rendered when sidebar is open
- Mobile: tab bar rendered with "Notes", "Edit", "Preview" labels
- Mobile: only active panel content is visible
- Mobile: tab bar buttons have minimum 44px height

#### Integration tests (`frontend/src/__tests__/WorkspaceResponsive.test.jsx`):
- Sidebar toggle opens/closes the overlay on tablet
- Clicking backdrop closes sidebar overlay
- Tab bar switches between panels on mobile
- Selecting a note on mobile switches to editor panel
- No horizontal scrollbar at tested viewport widths (check overflow)

**Note on testing viewports:** Vitest/jsdom does not have a real viewport. Tests should verify the presence of the correct responsive Tailwind classes (e.g., `lg:grid-cols-[260px_1fr_1fr]`, `md:hidden`, `lg:hidden`) and test state-driven behavior (sidebarOpen, activePanel) rather than simulating viewport resize.

## Acceptance Criteria (from Task Plan)

1. At 768px-1023px: editor + preview visible; sidebar collapsed behind a hamburger toggle (top-left)
2. At < 768px: single panel visible at a time; tab bar ("Notes" / "Edit" / "Preview") for panel switching
3. Sidebar overlay on tablet (fixed position, slides in from left with 0.2s transition)
4. No horizontal scrollbar at 375px, 768px, 1024px, or 1920px viewport widths
5. All interactive elements have minimum 44px touch targets on viewports < 768px
6. Tab bar uses clear labels, not icons alone

## Files to Touch

| File | Action |
|---|---|
| `frontend/src/components/common/HamburgerToggle.jsx` | Implement (replace stub) |
| `frontend/src/components/layout/WorkspaceLayout.jsx` | Refactor for responsive breakpoints |
| `frontend/src/pages/WorkspacePage.jsx` | Add responsive state (sidebarOpen, activePanel, handlers) |
| `frontend/src/__tests__/HamburgerToggle.test.jsx` | Create |
| `frontend/src/__tests__/WorkspaceLayout.responsive.test.jsx` | Create |
| `frontend/src/__tests__/WorkspaceResponsive.test.jsx` | Create |
| `frontend/src/__tests__/WorkspaceLayout.test.jsx` | May need update (grid assertion change) |
| `frontend/src/__tests__/WorkspacePage.test.jsx` | May need update (grid assertion change) |
| `frontend/src/__tests__/TASK-008-note-catalog-ui-verifier.test.jsx` | May need update (grid assertion change) |

## Constraints

- Do NOT modify `frontend/tailwind.config.js` -- the design token system is frozen (ADR-008, FF-D35)
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) -- do not use JavaScript `window.innerWidth` checks for layout (use CSS/Tailwind approach)
- All existing desktop tests must continue to pass -- the desktop layout must not regress
- No new npm dependencies required -- this is CSS/Tailwind only
- Sidebar overlay z-index must not conflict with any existing z-index usage
- Style consistently with ADR-008 design tokens: borders are `border-border` (1px solid), backgrounds use semantic tokens, no shadows or gradients

## Commit Convention

Commit message: `TASK-018: Responsive design -- [summary of what was done]`

Push to `main` branch after committing.

## Handoff

After completing implementation and tests, provide:
1. What was built (files changed/created)
2. Test results (all tests passing, count)
3. Any deviations from this routing instruction
4. Any observations or concerns
