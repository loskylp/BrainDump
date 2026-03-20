# ADR-009: Responsive Design Strategy
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

REQ-013 requires the three-panel workspace layout (catalog sidebar + source editor + live preview) to degrade gracefully on viewports from 375px (mobile) to 1920px (desktop). The three-panel layout is a Nexus-decided ground truth for desktop. The challenge is making this layout functional on narrow viewports where three simultaneous panels are physically impossible.

**Driver:** Maintainability (one codebase for all viewports), Testability (breakpoint behavior is deterministic)
**Door type:** Two-way -- breakpoints and collapse behavior are CSS configuration; changing them does not affect application logic or data flow

## Trade-off Analysis

### Responsive Strategy

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Progressive collapse (panels hide/show at breakpoints) | Preserves panel architecture, each panel remains a full component, deterministic breakpoints | Some content hidden at narrower widths, user must toggle to access hidden panels | Toggle interaction may not be discoverable | LOW -- adjust breakpoints and toggle behavior |
| Separate mobile layout (different component tree) | Optimized experience per viewport | Two UIs to maintain, code duplication, feature parity risk | Maintenance burden doubles, mobile UI lags behind desktop | HIGH -- maintaining two parallel UIs |
| Fluid scaling (all panels shrink proportionally) | Always shows all three panels | Below ~900px, panels are too narrow to be usable -- editor becomes 200px wide, preview is unreadable | Unusable on mobile and tablet | MEDIUM -- must still implement collapse behavior |

**Recommendation:** Progressive collapse
**Because:** The three-panel layout has a minimum useful width per panel (~300px for editor, ~250px for preview, ~200px for sidebar). Below the sum of these minimums, panels must be hidden rather than crushed. Progressive collapse hides panels in priority order (sidebar first, then preview, then editor fills the screen) while keeping toggle controls accessible.

### Layout Technology

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| CSS Grid | Native browser support, two-dimensional layout control, media queries for breakpoint behavior | Learning curve for complex grid templates | None -- CSS Grid is the standard for page-level layout | LOW -- CSS-only change |
| Flexbox | Familiar, simple for one-dimensional layouts | Awkward for two-dimensional grid of panels, requires nesting for the three-panel layout | Maintenance complexity for responsive behavior | LOW -- CSS-only change |
| JavaScript-driven layout | Full control, can use drag-to-resize panels | Janky on resize, accessibility issues, browser layout thrashing | Over-engineering for breakpoint-based responsiveness | MEDIUM -- remove JS layout logic, adopt CSS |

**Recommendation:** CSS Grid
**Because:** CSS Grid provides native two-dimensional layout with `grid-template-columns` that responds to media queries. The three-panel workspace maps directly to a grid with three column tracks. Collapsing a panel means removing its track from the grid definition -- no JavaScript layout logic needed.

## Decision

### Breakpoint Behavior

| Viewport width | Layout | Panel visibility | Toggle controls |
|---|---|---|---|
| >= 1024px | Three-panel grid | Sidebar + Editor + Preview all visible | None needed -- all panels shown |
| 768px - 1023px | Two-panel grid + sidebar toggle | Editor + Preview visible; Sidebar collapsed to icon strip or hidden behind hamburger toggle | Sidebar toggle button (top-left) |
| < 768px | Single panel + navigation drawer | One panel visible at a time; tabs or swipe to switch between Sidebar, Editor, and Preview | Bottom tab bar or top tab strip: "Notes" / "Edit" / "Preview" |

### CSS Grid Structure

```css
/* Desktop: three panels */
.workspace {
    display: grid;
    grid-template-columns: 260px 1fr 1fr;
    height: 100vh;
}

/* Tablet: editor + preview, sidebar toggled */
@media (max-width: 1023px) {
    .workspace {
        grid-template-columns: 1fr 1fr;
    }
    .sidebar {
        position: fixed;
        left: 0;
        width: 260px;
        transform: translateX(-100%);
        transition: transform 0.2s;
    }
    .sidebar.open {
        transform: translateX(0);
    }
}

/* Mobile: single panel with tabs */
@media (max-width: 767px) {
    .workspace {
        grid-template-columns: 1fr;
    }
    .workspace > * {
        display: none;
    }
    .workspace > .active-panel {
        display: block;
    }
}
```

### Panel Priority

When collapsing, panels are hidden in this priority order (least critical to most critical):
1. **Sidebar** (first to hide) -- the catalog is important but not needed during active editing
2. **Preview** (second to hide) -- useful but the user can mentally render Markdown
3. **Editor** (last to hide) -- always visible; the core interaction

### Sidebar Width

The sidebar has a fixed width of 260px on desktop. This is wide enough to display note titles and dates without truncation, narrow enough to leave 660px+ for the editor and preview panels at 1024px. The sidebar width is not user-adjustable in v1 (deferred decision).

### Touch Considerations

On mobile viewports (< 768px):
- All interactive elements have minimum 44px touch targets (iOS HIG recommendation)
- The tab bar for panel switching uses clear labels ("Notes", "Edit", "Preview") rather than icons alone
- Swipe gestures for panel switching are deferred -- not implemented in v1 (added complexity, accessibility concerns)

## Fitness Functions

**Dev:**
- Test: at 1920px, all three panels are visible simultaneously
- Test: at 800px, editor and preview are visible; sidebar is hidden but accessible via toggle
- Test: at 375px, only one panel is visible at a time; tab bar is present
- Test: no horizontal scrollbar appears at any tested viewport width (375px, 768px, 1024px, 1920px)
- Test: all interactive elements have minimum 44px touch target on viewports < 768px
- Lighthouse CI: performance audit passes at both mobile and desktop presets

**Prod:**
- No production-side responsive verification (verified in development and at Demo Sign-off)
- Monitor viewport distribution in analytics (if analytics are added) to understand user base and prioritize breakpoints

## Consequences

- Mobile users see a simplified single-panel experience -- they can write notes but cannot see the live preview simultaneously. This is an accepted limitation of the three-panel architecture on narrow viewports.
- The CSS Grid approach means the layout is CSS-only -- no JavaScript layout calculations, no resize observers, no layout thrashing. The framework handles the breakpoints declaratively.
- The sidebar toggle on tablet viewports overlays the sidebar on top of the editor content -- this is a common pattern but means the user cannot see the catalog and edit simultaneously on tablets. Acceptable for v1.
- Fixed sidebar width (260px) may truncate long note titles -- the catalog should show truncated titles with ellipsis. This is a UI implementation detail for the Builder.
