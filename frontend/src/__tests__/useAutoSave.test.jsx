/**
 * Tests for useAutoSave hook (TASK-012).
 *
 * Verifies:
 *   AC-1: 2-second debounce timer resets on every content change
 *   AC-2: On timer fire, calls PUT /api/notes/:id
 *   AC-3: Visual status transitions: idle -> pending -> saving -> saved -> idle
 *   AC-4: Auto-save updates notes row only (no version API calls)
 *   AC-5: On failure, status is 'error'
 *   AC-7: Multiple rapid edits reset debounce; only final state saved
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoSave } from '../hooks/useAutoSave.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateNote = vi.fn();

vi.mock('../api/notes.js', () => ({
  updateNote: (...args) => mockUpdateNote(...args),
  getNotes: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn(),
  deleteNote: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUpdateNote.mockResolvedValue({ note: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns idle status initially', () => {
    const { result } = renderHook(() =>
      useAutoSave({
        noteId: 'note-1',
        content: { title: 'T', body: 'B' },
        debounceMs: 2000,
      })
    );

    expect(result.current.status).toBe('idle');
  });

  it('does not save on initial content load (AC-6)', () => {
    renderHook(() =>
      useAutoSave({
        noteId: 'note-1',
        content: { title: 'T', body: 'B' },
        debounceMs: 2000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockUpdateNote).not.toHaveBeenCalled();
  });

  it('sets status to pending when content changes', () => {
    const { result, rerender } = renderHook(
      ({ content }) =>
        useAutoSave({
          noteId: 'note-1',
          content,
          debounceMs: 2000,
        }),
      { initialProps: { content: { title: 'T', body: 'B' } } }
    );

    // Change content
    rerender({ content: { title: 'T', body: 'B changed' } });

    expect(result.current.status).toBe('pending');
  });

  it('calls updateNote after debounce period (AC-1, AC-2)', async () => {
    const { rerender } = renderHook(
      ({ content }) =>
        useAutoSave({
          noteId: 'note-1',
          content,
          debounceMs: 2000,
        }),
      { initialProps: { content: { title: 'T', body: 'B' } } }
    );

    // Change content to trigger debounce
    rerender({ content: { title: 'T', body: 'B changed' } });

    // Before debounce
    expect(mockUpdateNote).not.toHaveBeenCalled();

    // After debounce
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', {
      title: 'T',
      body: 'B changed',
    });
  });

  it('resets debounce timer on rapid edits (AC-7)', async () => {
    const { rerender } = renderHook(
      ({ content }) =>
        useAutoSave({
          noteId: 'note-1',
          content,
          debounceMs: 2000,
        }),
      { initialProps: { content: { title: 'T', body: 'B' } } }
    );

    // First edit
    rerender({ content: { title: 'T', body: 'B1' } });

    // Wait 1 second (less than debounce)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Second edit resets the timer
    rerender({ content: { title: 'T', body: 'B2' } });

    // Wait another 1 second (only 1s since last edit, still less than 2s debounce)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should NOT have saved yet (timer reset by second edit)
    expect(mockUpdateNote).not.toHaveBeenCalled();

    // Wait the remaining second
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Now should have saved with the latest content
    expect(mockUpdateNote).toHaveBeenCalledTimes(1);
    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', {
      title: 'T',
      body: 'B2',
    });
  });

  it('transitions to saving then saved on success (AC-3)', async () => {
    let resolveUpdate;
    mockUpdateNote.mockImplementation(
      () => new Promise((resolve) => { resolveUpdate = resolve; })
    );

    const { result, rerender } = renderHook(
      ({ content }) =>
        useAutoSave({
          noteId: 'note-1',
          content,
          debounceMs: 2000,
        }),
      { initialProps: { content: { title: 'T', body: 'B' } } }
    );

    rerender({ content: { title: 'T', body: 'changed' } });

    // Trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe('saving');

    // Resolve the save
    await act(async () => {
      resolveUpdate({ note: {} });
    });

    expect(result.current.status).toBe('saved');

    // After display period, reverts to idle
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe('idle');
  });

  it('sets status to error on save failure (AC-5)', async () => {
    mockUpdateNote.mockRejectedValue(new Error('Network error'));

    const { result, rerender } = renderHook(
      ({ content }) =>
        useAutoSave({
          noteId: 'note-1',
          content,
          debounceMs: 2000,
        }),
      { initialProps: { content: { title: 'T', body: 'B' } } }
    );

    rerender({ content: { title: 'T', body: 'changed' } });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe('error');
  });

  it('does not save when noteId is null', async () => {
    const { rerender } = renderHook(
      ({ noteId, content }) =>
        useAutoSave({ noteId, content, debounceMs: 2000 }),
      { initialProps: { noteId: null, content: { title: 'T', body: 'B' } } }
    );

    rerender({ noteId: null, content: { title: 'T', body: 'changed' } });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockUpdateNote).not.toHaveBeenCalled();
  });

  it('resets status to idle when noteId changes', () => {
    const { result, rerender } = renderHook(
      ({ noteId, content }) =>
        useAutoSave({ noteId, content, debounceMs: 2000 }),
      {
        initialProps: {
          noteId: 'note-1',
          content: { title: 'T', body: 'B' },
        },
      }
    );

    // Change content to get to pending
    rerender({ noteId: 'note-1', content: { title: 'T', body: 'changed' } });
    expect(result.current.status).toBe('pending');

    // Switch to a different note
    rerender({ noteId: 'note-2', content: { title: 'T2', body: 'B2' } });
    expect(result.current.status).toBe('idle');
  });

  it('saves title changes', async () => {
    const { rerender } = renderHook(
      ({ content }) =>
        useAutoSave({
          noteId: 'note-1',
          content,
          debounceMs: 2000,
        }),
      { initialProps: { content: { title: 'Original', body: 'B' } } }
    );

    rerender({ content: { title: 'Updated Title', body: 'B' } });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockUpdateNote).toHaveBeenCalledWith('note-1', {
      title: 'Updated Title',
      body: 'B',
    });
  });
});
