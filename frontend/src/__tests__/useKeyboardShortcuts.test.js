/**
 * Unit tests for useKeyboardShortcuts hook (TASK-025, REQ-018).
 *
 * Tests verify:
 *   - Each shortcut fires the correct callback
 *   - Input suppression rules (shortcuts blocked in INPUT/TEXTAREA/contenteditable
 *     except Cmd+S and Cmd+N which fire even when a text field is focused)
 *   - Cleanup on unmount (no listener leaks)
 *   - Browser-reserved shortcuts (W, T, L, R, Tab) are not intercepted
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fires a synthetic keydown event on document with the given properties.
 *
 * @param {object} options
 * @param {string} options.key - The key value (e.g. 's', 'n', 'Escape', '?')
 * @param {boolean} [options.metaKey=false]
 * @param {boolean} [options.ctrlKey=false]
 * @param {EventTarget} [options.target=document.body] - The event target
 */
function fireKeydown({ key, metaKey = false, ctrlKey = false, target = document.body }) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey,
    ctrlKey,
    bubbles: true,
    cancelable: true,
  });
  // Override the target using Object.defineProperty since it is read-only on real events
  Object.defineProperty(event, 'target', { value: target, writable: false });
  act(() => {
    document.dispatchEvent(event);
  });
  return event;
}

/**
 * Creates a fake DOM element with the given tag name.
 * Used to simulate events originating inside INPUT or TEXTAREA elements.
 *
 * @param {string} tagName - e.g. 'INPUT', 'TEXTAREA'
 * @returns {HTMLElement}
 */
function fakeTarget(tagName) {
  const el = document.createElement(tagName);
  return el;
}

/**
 * Creates a fake contenteditable element.
 * @returns {HTMLElement}
 */
function fakeContentEditable() {
  const el = document.createElement('div');
  el.setAttribute('contenteditable', 'true');
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  let onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic;

  beforeEach(() => {
    onSave = vi.fn();
    onNewNote = vi.fn();
    onFocusSearch = vi.fn();
    onToggleShortcutRef = vi.fn();
    onEscape = vi.fn();
    onBold = vi.fn();
    onItalic = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Cmd/Ctrl+S
  // -------------------------------------------------------------------------

  it('calls onSave when Cmd+S is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 's', metaKey: true });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onSave when Ctrl+S is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onSave even when target is INPUT (editor exception)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 's', metaKey: true, target: fakeTarget('INPUT') });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onSave even when target is TEXTAREA (editor exception)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 's', metaKey: true, target: fakeTarget('TEXTAREA') });
    expect(onSave).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Cmd/Ctrl+N
  // -------------------------------------------------------------------------

  it('calls onNewNote when Cmd+N is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'n', metaKey: true });
    expect(onNewNote).toHaveBeenCalledOnce();
  });

  it('calls onNewNote when Ctrl+N is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'n', ctrlKey: true });
    expect(onNewNote).toHaveBeenCalledOnce();
  });

  it('calls onNewNote even when target is INPUT (editor exception)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'n', metaKey: true, target: fakeTarget('INPUT') });
    expect(onNewNote).toHaveBeenCalledOnce();
  });

  it('calls onNewNote even when target is TEXTAREA (editor exception)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'n', metaKey: true, target: fakeTarget('TEXTAREA') });
    expect(onNewNote).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Cmd/Ctrl+K
  // -------------------------------------------------------------------------

  it('calls onFocusSearch when Cmd+K is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'k', metaKey: true });
    expect(onFocusSearch).toHaveBeenCalledOnce();
  });

  it('calls onFocusSearch when Ctrl+K is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'k', ctrlKey: true });
    expect(onFocusSearch).toHaveBeenCalledOnce();
  });

  it('does NOT call onFocusSearch when target is INPUT', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'k', metaKey: true, target: fakeTarget('INPUT') });
    expect(onFocusSearch).not.toHaveBeenCalled();
  });

  it('does NOT call onFocusSearch when target is TEXTAREA', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'k', metaKey: true, target: fakeTarget('TEXTAREA') });
    expect(onFocusSearch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // ? key — toggle shortcut reference overlay
  // -------------------------------------------------------------------------

  it('calls onToggleShortcutRef when ? is pressed outside a text field', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: '?' });
    expect(onToggleShortcutRef).toHaveBeenCalledOnce();
  });

  it('does NOT call onToggleShortcutRef when ? is pressed inside INPUT', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: '?', target: fakeTarget('INPUT') });
    expect(onToggleShortcutRef).not.toHaveBeenCalled();
  });

  it('does NOT call onToggleShortcutRef when ? is pressed inside TEXTAREA', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: '?', target: fakeTarget('TEXTAREA') });
    expect(onToggleShortcutRef).not.toHaveBeenCalled();
  });

  it('does NOT call onToggleShortcutRef when ? is pressed inside contenteditable', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: '?', target: fakeContentEditable() });
    expect(onToggleShortcutRef).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cmd/Ctrl+B — bold
  // -------------------------------------------------------------------------

  it('calls onBold when Cmd+B is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'b', metaKey: true });
    expect(onBold).toHaveBeenCalledOnce();
  });

  it('calls onBold when Ctrl+B is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'b', ctrlKey: true });
    expect(onBold).toHaveBeenCalledOnce();
  });

  it('calls onBold even when target is INPUT (editor context)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'b', metaKey: true, target: fakeTarget('INPUT') });
    expect(onBold).toHaveBeenCalledOnce();
  });

  it('calls onBold even when target is contenteditable (editor context)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'b', metaKey: true, target: fakeContentEditable() });
    expect(onBold).toHaveBeenCalledOnce();
  });

  it('does NOT call onBold when B is pressed without a modifier key', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'b' });
    expect(onBold).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cmd/Ctrl+I — italic
  // -------------------------------------------------------------------------

  it('calls onItalic when Cmd+I is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'i', metaKey: true });
    expect(onItalic).toHaveBeenCalledOnce();
  });

  it('calls onItalic when Ctrl+I is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'i', ctrlKey: true });
    expect(onItalic).toHaveBeenCalledOnce();
  });

  it('calls onItalic even when target is INPUT (editor context)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'i', metaKey: true, target: fakeTarget('INPUT') });
    expect(onItalic).toHaveBeenCalledOnce();
  });

  it('calls onItalic even when target is contenteditable (editor context)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'i', metaKey: true, target: fakeContentEditable() });
    expect(onItalic).toHaveBeenCalledOnce();
  });

  it('does NOT call onItalic when I is pressed without a modifier key', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'i' });
    expect(onItalic).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Escape still fires even with new shortcuts registered
  // -------------------------------------------------------------------------

  it('calls onEscape when Escape is pressed (with onBold and onItalic registered)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape, onBold, onItalic })
    );
    fireKeydown({ key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Escape
  // -------------------------------------------------------------------------

  it('calls onEscape when Escape is pressed', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Browser-reserved shortcuts must NOT be intercepted
  // -------------------------------------------------------------------------

  it('does not call any handler for Cmd+W (browser close tab)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'w', metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(onNewNote).not.toHaveBeenCalled();
    expect(onFocusSearch).not.toHaveBeenCalled();
    expect(onToggleShortcutRef).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('does not call any handler for Cmd+T (browser new tab)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 't', metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(onNewNote).not.toHaveBeenCalled();
  });

  it('does not call any handler for Cmd+L (browser address bar)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'l', metaKey: true });
    expect(onFocusSearch).not.toHaveBeenCalled();
  });

  it('does not call any handler for Cmd+R (browser reload)', () => {
    renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );
    fireKeydown({ key: 'r', metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Missing callbacks (no crash)
  // -------------------------------------------------------------------------

  it('does not throw when callbacks are omitted', () => {
    expect(() => {
      renderHook(() => useKeyboardShortcuts({}));
      fireKeydown({ key: 's', metaKey: true });
      fireKeydown({ key: 'n', metaKey: true });
      fireKeydown({ key: 'k', metaKey: true });
      fireKeydown({ key: '?' });
      fireKeydown({ key: 'Escape' });
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------

  it('removes the keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('does not fire callbacks after unmount', () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ onSave, onNewNote, onFocusSearch, onToggleShortcutRef, onEscape })
    );

    unmount();

    fireKeydown({ key: 's', metaKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });
});
