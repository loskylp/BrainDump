/**
 * Unit tests for HamburgerToggle component (TASK-018).
 *
 * Covers:
 *   - Renders a button with correct aria-label based on isOpen state
 *   - aria-expanded attribute matches isOpen prop
 *   - Calls onToggle when clicked
 *   - Has minimum 44px touch target (h-11 w-11 classes)
 *   - Has lg:hidden class (hidden on desktop)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HamburgerToggle from '../components/common/HamburgerToggle.jsx';

describe('HamburgerToggle', () => {
  it('renders a button with aria-label "Toggle sidebar" when closed', () => {
    render(<HamburgerToggle isOpen={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(button).toBeTruthy();
  });

  it('renders a button with aria-label "Close sidebar" when open', () => {
    render(<HamburgerToggle isOpen={true} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Close sidebar' });
    expect(button).toBeTruthy();
  });

  it('has aria-expanded="false" when isOpen is false', () => {
    render(<HamburgerToggle isOpen={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('has aria-expanded="true" when isOpen is true', () => {
    render(<HamburgerToggle isOpen={true} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Close sidebar' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<HamburgerToggle isOpen={false} onToggle={onToggle} />);

    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('has h-11 and w-11 classes for minimum 44px touch target', () => {
    render(<HamburgerToggle isOpen={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('w-11');
  });

  it('has lg:hidden class so it is hidden on desktop viewports', () => {
    render(<HamburgerToggle isOpen={false} onToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(button.className).toContain('lg:hidden');
  });
});
