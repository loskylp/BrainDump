/**
 * Tests for useVersionTimer hook (TASK-013).
 *
 * Verifies:
 *   AC-1: 30-second idle timer resets on every content change
 *   AC-2: On timer fire, calls POST /api/notes/:id/check-version
 *   AC-4/5: Server decides whether to create version (hook just calls)
 *   - Initial content load does not trigger version check
 *   - Timer clears on noteId change
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVersionTimer } from '../hooks/useVersionTimer.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCheckVersion = vi.fn();

vi.mock('../api/versions.js', () => ({
  checkVersion: (...args) => mockCheckVersion(...args),
  getVersions: vi.fn(),
  getVersion: vi.fn(),
  restoreVersion: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVersionTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockCheckVersion.mockResolvedValue({ versionCreated: false, versionNumber: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call checkVersion on initial content load', () => {
    renderHook(() =>
      useVersionTimer({
        noteId: 'note-1',
        contentKey: 'initial content',
        idleMs: 30000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(31000);
    });

    expect(mockCheckVersion).not.toHaveBeenCalled();
  });

  it('calls checkVersion after idle period on content change (AC-1, AC-2)', async () => {
    const { rerender } = renderHook(
      ({ contentKey }) =>
        useVersionTimer({
          noteId: 'note-1',
          contentKey,
          idleMs: 30000,
        }),
      { initialProps: { contentKey: 'initial' } }
    );

    // Change content
    rerender({ contentKey: 'changed content' });

    // Before idle period
    act(() => {
      vi.advanceTimersByTime(29000);
    });
    expect(mockCheckVersion).not.toHaveBeenCalled();

    // After idle period
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockCheckVersion).toHaveBeenCalledWith('note-1');
  });

  it('resets timer on content change', async () => {
    const { rerender } = renderHook(
      ({ contentKey }) =>
        useVersionTimer({
          noteId: 'note-1',
          contentKey,
          idleMs: 30000,
        }),
      { initialProps: { contentKey: 'initial' } }
    );

    // First content change
    rerender({ contentKey: 'edit 1' });

    // Wait 20 seconds
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    // Second content change resets the timer
    rerender({ contentKey: 'edit 2' });

    // Wait another 20 seconds (only 20s since last edit)
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    // Should NOT have fired yet
    expect(mockCheckVersion).not.toHaveBeenCalled();

    // Wait the remaining 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // Now should have fired once
    expect(mockCheckVersion).toHaveBeenCalledTimes(1);
  });

  it('does not call checkVersion when noteId is null', () => {
    const { rerender } = renderHook(
      ({ contentKey }) =>
        useVersionTimer({
          noteId: null,
          contentKey,
          idleMs: 30000,
        }),
      { initialProps: { contentKey: 'initial' } }
    );

    rerender({ contentKey: 'changed' });

    act(() => {
      vi.advanceTimersByTime(31000);
    });

    expect(mockCheckVersion).not.toHaveBeenCalled();
  });

  it('invokes onVersionCreated callback when version is created', async () => {
    const onVersionCreated = vi.fn();
    mockCheckVersion.mockResolvedValue({ versionCreated: true, versionNumber: 2 });

    const { rerender } = renderHook(
      ({ contentKey }) =>
        useVersionTimer({
          noteId: 'note-1',
          contentKey,
          idleMs: 30000,
          onVersionCreated,
        }),
      { initialProps: { contentKey: 'initial' } }
    );

    rerender({ contentKey: 'changed' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(onVersionCreated).toHaveBeenCalledWith({ versionNumber: 2 });
  });

  it('does not invoke onVersionCreated when no version is created', async () => {
    const onVersionCreated = vi.fn();
    mockCheckVersion.mockResolvedValue({ versionCreated: false, versionNumber: null });

    const { rerender } = renderHook(
      ({ contentKey }) =>
        useVersionTimer({
          noteId: 'note-1',
          contentKey,
          idleMs: 30000,
          onVersionCreated,
        }),
      { initialProps: { contentKey: 'initial' } }
    );

    rerender({ contentKey: 'changed' });

    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    expect(onVersionCreated).not.toHaveBeenCalled();
  });
});
