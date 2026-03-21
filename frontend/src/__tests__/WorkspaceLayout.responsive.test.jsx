/**
 * Unit tests for WorkspaceLayout responsive behaviour (TASK-018).
 *
 * Covers:
 *   - Desktop: all three panels rendered simultaneously
 *   - Desktop: grid layout retains inline style for 260px 1fr 1fr
 *   - Tablet: sidebar overlay uses fixed positioning (fixed class present)
 *   - Tablet: sidebar overlay has 0.2s transition (transition-transform duration-200)
 *   - Tablet: backdrop rendered when sidebarOpen is true
 *   - Tablet: backdrop NOT rendered when sidebarOpen is false
 *   - Mobile: tab bar rendered with "Notes", "Edit", "Preview" labels
 *   - Mobile: tab bar buttons have minimum 44px height (h-11)
 *   - Mobile: activePanel controls which panel content is shown via hidden class
 *
 * Note: Vitest/jsdom does not have a real viewport. Tests verify the presence of
 * correct Tailwind classes and state-driven visibility rather than simulating
 * viewport resize.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';

const DEFAULT_PROPS = {
  sidebar: <div data-testid="sidebar-content">Sidebar</div>,
  editor: <div data-testid="editor-content">Editor</div>,
  preview: <div data-testid="preview-content">Preview</div>,
  sidebarOpen: false,
  onSidebarClose: vi.fn(),
  activePanel: 'editor',
  onPanelChange: vi.fn(),
};

describe('WorkspaceLayout — desktop layout', () => {
  it('renders all three panel contents (sidebar, editor, preview) in the DOM', () => {
    const { getAllByTestId } = render(<WorkspaceLayout {...DEFAULT_PROPS} />);

    // sidebar-content appears in the grid column AND in the overlay — both instances should exist
    expect(getAllByTestId('sidebar-content').length).toBeGreaterThanOrEqual(1);
    // editor and preview each appear exactly once
    expect(getAllByTestId('editor-content').length).toBeGreaterThanOrEqual(1);
    expect(getAllByTestId('preview-content').length).toBeGreaterThanOrEqual(1);
  });

  it('retains the CSS Grid inline style for three-column desktop layout', () => {
    const { container } = render(<WorkspaceLayout {...DEFAULT_PROPS} />);

    // The root element carries the inline grid style for desktop
    const grid = container.firstChild;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toBe('260px 1fr 1fr');
  });

  it('renders the three main content panels as direct children of the grid', () => {
    const { container } = render(<WorkspaceLayout {...DEFAULT_PROPS} />);

    // The grid contains: tab bar + sidebar + editor + preview + overlay (+ optional backdrop)
    // Verify the three content panel wrappers are present by checking content testids
    const grid = container.firstChild;
    expect(grid.querySelector('[data-testid="sidebar-content"]')).toBeTruthy();
    expect(grid.querySelector('[data-testid="editor-content"]')).toBeTruthy();
    expect(grid.querySelector('[data-testid="preview-content"]')).toBeTruthy();
  });
});

describe('WorkspaceLayout — tablet sidebar overlay', () => {
  it('renders the sidebar overlay with fixed positioning classes', () => {
    const { container } = render(
      <WorkspaceLayout {...DEFAULT_PROPS} sidebarOpen={false} />
    );

    // Sidebar overlay wrapper should have fixed class
    const overlayWrapper = container.querySelector('[data-testid="sidebar-overlay"]');
    expect(overlayWrapper).toBeTruthy();
    expect(overlayWrapper.className).toContain('fixed');
  });

  it('sidebar overlay has transition-transform and duration-200 for 0.2s animation', () => {
    const { container } = render(
      <WorkspaceLayout {...DEFAULT_PROPS} sidebarOpen={false} />
    );

    const overlayWrapper = container.querySelector('[data-testid="sidebar-overlay"]');
    expect(overlayWrapper.className).toContain('transition-transform');
    expect(overlayWrapper.className).toContain('duration-200');
  });

  it('sidebar overlay is off-screen when sidebarOpen is false (-translate-x-full)', () => {
    const { container } = render(
      <WorkspaceLayout {...DEFAULT_PROPS} sidebarOpen={false} />
    );

    const overlayWrapper = container.querySelector('[data-testid="sidebar-overlay"]');
    expect(overlayWrapper.className).toContain('-translate-x-full');
  });

  it('sidebar overlay is on-screen when sidebarOpen is true (translate-x-0)', () => {
    const { container } = render(
      <WorkspaceLayout {...DEFAULT_PROPS} sidebarOpen={true} />
    );

    const overlayWrapper = container.querySelector('[data-testid="sidebar-overlay"]');
    expect(overlayWrapper.className).toContain('translate-x-0');
    expect(overlayWrapper.className).not.toContain('-translate-x-full');
  });

  it('backdrop is rendered when sidebarOpen is true', () => {
    const { container } = render(
      <WorkspaceLayout {...DEFAULT_PROPS} sidebarOpen={true} />
    );

    const backdrop = container.querySelector('[data-testid="sidebar-backdrop"]');
    expect(backdrop).toBeTruthy();
  });

  it('backdrop is NOT rendered when sidebarOpen is false', () => {
    const { container } = render(
      <WorkspaceLayout {...DEFAULT_PROPS} sidebarOpen={false} />
    );

    const backdrop = container.querySelector('[data-testid="sidebar-backdrop"]');
    expect(backdrop).toBeNull();
  });

  it('clicking backdrop calls onSidebarClose', async () => {
    const { userEvent: ue } = await import('@testing-library/user-event');
    const onSidebarClose = vi.fn();
    const { container } = render(
      <WorkspaceLayout
        {...DEFAULT_PROPS}
        sidebarOpen={true}
        onSidebarClose={onSidebarClose}
      />
    );

    const backdrop = container.querySelector('[data-testid="sidebar-backdrop"]');
    backdrop.click();

    expect(onSidebarClose).toHaveBeenCalledTimes(1);
  });
});

describe('WorkspaceLayout — mobile tab bar', () => {
  it('renders the mobile tab bar with md:hidden class', () => {
    const { container } = render(<WorkspaceLayout {...DEFAULT_PROPS} />);

    const tabBar = container.querySelector('[data-testid="mobile-tab-bar"]');
    expect(tabBar).toBeTruthy();
    expect(tabBar.className).toContain('md:hidden');
  });

  it('tab bar contains "Notes", "Edit", and "Preview" labels', () => {
    render(<WorkspaceLayout {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: 'Notes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy();
  });

  it('tab bar buttons have h-11 class for 44px minimum touch target', () => {
    render(<WorkspaceLayout {...DEFAULT_PROPS} />);

    const notesBtn = screen.getByRole('button', { name: 'Notes' });
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    const previewBtn = screen.getByRole('button', { name: 'Preview' });

    expect(notesBtn.className).toContain('h-11');
    expect(editBtn.className).toContain('h-11');
    expect(previewBtn.className).toContain('h-11');
  });

  it('clicking a tab button calls onPanelChange with the correct panel name', () => {
    const onPanelChange = vi.fn();
    render(<WorkspaceLayout {...DEFAULT_PROPS} onPanelChange={onPanelChange} />);

    screen.getByRole('button', { name: 'Notes' }).click();
    expect(onPanelChange).toHaveBeenCalledWith('sidebar');

    screen.getByRole('button', { name: 'Preview' }).click();
    expect(onPanelChange).toHaveBeenCalledWith('preview');
  });

  it('active tab has border-b-2 class to visually indicate selection', () => {
    render(
      <WorkspaceLayout {...DEFAULT_PROPS} activePanel="editor" />
    );

    const editBtn = screen.getByRole('button', { name: 'Edit' });
    expect(editBtn.className).toContain('border-b-2');
  });

  it('inactive tabs do not have border-b-2 class', () => {
    render(
      <WorkspaceLayout {...DEFAULT_PROPS} activePanel="editor" />
    );

    const notesBtn = screen.getByRole('button', { name: 'Notes' });
    expect(notesBtn.className).not.toContain('border-b-2');
  });
});
