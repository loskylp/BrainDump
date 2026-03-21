# Demo Script — TASK-018: Responsive design (mobile/tablet breakpoints)
**Date:** 2026-03-21
**Environment:** https://braindump.staging.nxlabs.cc
**Prerequisites:** An authenticated user account. Open the workspace at `/workspace` before starting each scenario.

---

## Scenario 1 — Desktop layout unchanged (AC-1 baseline)

Given   A browser window at 1280px width (or any width >= 1024px)
When    The authenticated user navigates to `/workspace`
Then    Three panels are simultaneously visible: sidebar (left, 260px), editor (centre), preview (right)
        The hamburger toggle button is NOT visible
        All three panels are independently scrollable

---

## Scenario 2 — Tablet: hamburger toggle opens and closes the sidebar (AC-1, AC-3)

Given   A browser window resized to 900px width (768px–1023px range)
When    The page loads
Then    The sidebar is hidden; only the editor and preview columns are visible
        A hamburger icon button appears at the top-left of the workspace

When    The user clicks the hamburger button
Then    The sidebar slides in from the left over approximately 0.2 seconds
        A semi-transparent dark backdrop covers the editor and preview panels behind the sidebar
        The hamburger button now shows an X icon

When    The user clicks the X button
Then    The sidebar slides back out to the left
        The backdrop disappears
        The workspace shows only editor and preview again

When    The sidebar is open and the user presses the Escape key
Then    The sidebar closes (same result as clicking X)

When    The sidebar is open and the user clicks the dark backdrop
Then    The sidebar closes

---

## Scenario 3 — Tablet: note selection closes the sidebar (AC-1, AC-2)

Given   A browser window at 900px width with at least one note in the catalog
When    The user opens the sidebar via the hamburger toggle
        The user clicks a note title in the catalog

Then    The sidebar closes automatically
        The selected note loads into the editor

---

## Scenario 4 — Mobile: single-panel tab bar navigation (AC-2, AC-5, AC-6)

Given   A browser window resized to 375px width (< 768px)
When    The page loads
Then    A tab bar is visible at the top of the workspace with three labelled tabs: "Notes", "Edit", "Preview"
        Only the editor panel is visible (Edit tab is active by default, indicated by a blue underline)
        The sidebar and preview panels are not visible

When    The user taps the "Preview" tab
Then    The preview panel becomes visible
        The "Preview" tab shows a blue underline
        The editor panel is no longer visible

When    The user taps the "Notes" tab
Then    The sidebar catalog becomes visible
        The "Notes" tab shows a blue underline
        The preview and editor panels are no longer visible

When    The user taps the "Edit" tab
Then    The editor returns to view
        The "Edit" tab shows a blue underline

Note    Each tab button is at least 44px tall — confirm by inspecting touch target size

---

## Scenario 5 — Mobile: selecting a note switches to editor (AC-2)

Given   A browser window at 375px width with at least one note in the catalog
When    The user taps the "Notes" tab to view the sidebar
        The user taps a note in the catalog

Then    The active panel switches automatically to "Edit"
        The editor loads the selected note's content
        The "Edit" tab is highlighted with a blue underline

---

## Scenario 6 — No horizontal scrollbar at any breakpoint (AC-4)

Given   A browser window at each of the following widths: 375px, 768px, 1024px, 1920px
When    The user loads the workspace at each width
Then    No horizontal scrollbar is present
        The page does not overflow its viewport horizontally at any width

---

## Scenario 7 — Design token consistency (ADR-008)

Given   The sidebar overlay is visible on tablet (900px viewport)
When    The user inspects the sidebar panel appearance
Then    The sidebar background matches the secondary panel colour (light grey, #F8F9FA)
        The sidebar has a 1px solid right border separating it from the editor
        No shadows, gradients, or rounded corners are present on the overlay panel
        The hamburger toggle button uses the secondary background with a 1px border
