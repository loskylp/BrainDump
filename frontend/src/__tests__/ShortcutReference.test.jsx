/**
 * Unit tests for ShortcutReference component (TASK-025, REQ-018).
 *
 * Tests verify:
 *   - Renders the shortcut list when isOpen is true
 *   - Does not render when isOpen is false
 *   - Close button calls onClose
 *   - Escape key calls onClose (via keydown on document)
 *   - Accessible attributes: role="dialog", aria-label="Keyboard shortcuts", aria-modal="true"
 *   - All defined shortcuts appear in the panel
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ShortcutReference from '../components/common/ShortcutReference.jsx';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOpen(onClose = vi.fn()) {
  return render(<ShortcutReference isOpen={true} onClose={onClose} />);
}

function renderClosed(onClose = vi.fn()) {
  return render(<ShortcutReference isOpen={false} onClose={onClose} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShortcutReference', () => {
  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  it('renders the overlay when isOpen is true', () => {
    renderOpen();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render the dialog when isOpen is false', () => {
    renderClosed();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Accessibility attributes
  // -------------------------------------------------------------------------

  it('has role="dialog" when open', () => {
    renderOpen();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has aria-label="Keyboard shortcuts"', () => {
    renderOpen();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Keyboard shortcuts');
  });

  it('has aria-modal="true"', () => {
    renderOpen();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  // -------------------------------------------------------------------------
  // Shortcut entries
  // -------------------------------------------------------------------------

  it('lists the Cmd/Ctrl+S shortcut', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Save note');
  });

  it('lists the Cmd/Ctrl+N shortcut', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('New note');
  });

  it('lists the Cmd/Ctrl+K shortcut', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Focus search');
  });

  it('lists the ? shortcut', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Show/hide shortcuts');
  });

  it('lists the Escape shortcut', () => {
    renderOpen();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Close panel');
  });

  // -------------------------------------------------------------------------
  // Close button
  // -------------------------------------------------------------------------

  it('renders a close button', () => {
    renderOpen();
    // The close button can be found by its accessible role or test id
    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    renderOpen(onClose);
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Escape key
  // -------------------------------------------------------------------------

  it('calls onClose when Escape is pressed while the dialog is open', () => {
    const onClose = vi.fn();
    renderOpen(onClose);

    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when the dialog is closed and Escape is pressed', () => {
    const onClose = vi.fn();
    renderClosed(onClose);

    fireEvent.keyDown(document, { key: 'Escape', bubbles: true });
    expect(onClose).not.toHaveBeenCalled();
  });
});
