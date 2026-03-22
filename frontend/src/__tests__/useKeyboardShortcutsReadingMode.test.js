/**
 * Unit tests for the Cmd/Ctrl+Shift+R reading mode shortcut added to
 * useKeyboardShortcuts (TASK-030, REQ-022).
 *
 * These tests extend the existing useKeyboardShortcuts test suite with the
 * new onReadingMode callback. They are kept in a separate file so the
 * original test file is not modified (Open/Closed principle at the test level).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

// ---------------------------------------------------------------------------
// Helpers (duplicated from the main test file for isolation)
// ---------------------------------------------------------------------------

function fireKeydown({ key, metaKey = false, ctrlKey = false, shiftKey = false, target = document.body }) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'target', { value: target, writable: false });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

function fakeTarget(tagName) {
  return document.createElement(tagName);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts — Cmd/Ctrl+Shift+R (reading mode)', () => {
  let onReadingMode;

  beforeEach(() => {
    onReadingMode = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onReadingMode when Cmd+Shift+R is pressed', () => {
    renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    expect(onReadingMode).toHaveBeenCalledOnce();
  });

  it('calls onReadingMode when Ctrl+Shift+R is pressed', () => {
    renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    fireKeydown({ key: 'r', ctrlKey: true, shiftKey: true });
    expect(onReadingMode).toHaveBeenCalledOnce();
  });

  it('does NOT call onReadingMode when Cmd+R is pressed without Shift (browser reload preserve)', () => {
    renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    fireKeydown({ key: 'r', metaKey: true, shiftKey: false });
    expect(onReadingMode).not.toHaveBeenCalled();
  });

  it('does NOT call onReadingMode when R is pressed without any modifier', () => {
    renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    fireKeydown({ key: 'r' });
    expect(onReadingMode).not.toHaveBeenCalled();
  });

  it('calls onReadingMode even when target is INPUT (consistent with save/new-note pattern)', () => {
    renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true, target: fakeTarget('INPUT') });
    expect(onReadingMode).toHaveBeenCalledOnce();
  });

  it('calls onReadingMode even when target is TEXTAREA', () => {
    renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true, target: fakeTarget('TEXTAREA') });
    expect(onReadingMode).toHaveBeenCalledOnce();
  });

  it('does not throw when onReadingMode is not provided', () => {
    expect(() => {
      renderHook(() => useKeyboardShortcuts({}));
      fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    }).not.toThrow();
  });

  it('does not call onReadingMode after unmount', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onReadingMode }));
    unmount();
    fireKeydown({ key: 'r', metaKey: true, shiftKey: true });
    expect(onReadingMode).not.toHaveBeenCalled();
  });
});
