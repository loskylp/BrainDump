/**
 * Unit tests for SearchBar component (TASK-014).
 *
 * Verifies the SearchBar contract:
 *   - Renders an input with the correct placeholder
 *   - Calls onResults with results after the 300ms debounce
 *   - Calls onClear() immediately when input is cleared without an API call
 *   - Shows a loading indicator while search is in flight
 *   - Forwards ref to the input element
 *   - Calls onError on API failure when onError prop is provided
 *
 * The search API module is mocked — no network requests occur.
 * Uses fireEvent.change (synchronous) to avoid conflicts between userEvent's
 * internal delays and vi.useFakeTimers(). Uses await act(async () => ...) with
 * vi.advanceTimersByTime to control debounce timing precisely.
 */

import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import SearchBar from '../components/Search/SearchBar.jsx';

// ---------------------------------------------------------------------------
// Mock the search API module
// ---------------------------------------------------------------------------

vi.mock('../api/search.js', () => ({
  search: vi.fn(),
}));

import { search as mockSearch } from '../api/search.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds default props for SearchBar, merging any provided overrides.
 */
function makeProps(overrides = {}) {
  return {
    onResults: vi.fn(),
    onClear: vi.fn(),
    onError: vi.fn(),
    ...overrides,
  };
}

/**
 * Fires a synchronous change event on the given input element.
 * Using fireEvent instead of userEvent.type avoids conflicts with fake timers.
 *
 * @param {HTMLElement} input
 * @param {string} value
 */
function changeInput(input, value) {
  fireEvent.change(input, { target: { value } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchBar (TASK-014)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an input with the default placeholder', () => {
    const props = makeProps();
    render(<SearchBar {...props} />);

    expect(screen.getByPlaceholderText('Search notes...')).toBeDefined();
  });

  it('renders an input with a custom placeholder when provided', () => {
    const props = makeProps({ placeholder: 'Find notes...' });
    render(<SearchBar {...props} />);

    expect(screen.getByPlaceholderText('Find notes...')).toBeDefined();
  });

  it('calls onResults with results after the 300ms debounce', async () => {
    const fakeResults = [{ id: 'n1', title: 'Hello', snippet: '<mark>Hello</mark>' }];
    mockSearch.mockResolvedValue({ results: fakeResults });

    const props = makeProps();
    render(<SearchBar {...props} />);

    const input = screen.getByPlaceholderText('Search notes...');
    changeInput(input, 'hello');

    // Before debounce fires, search must not have been called
    expect(mockSearch).not.toHaveBeenCalled();

    // Fire the debounce and let the async mock resolve
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledWith('hello');
    expect(props.onResults).toHaveBeenCalledWith(fakeResults);
  });

  it('calls onClear() immediately when input is cleared, without an API call', async () => {
    mockSearch.mockResolvedValue({ results: [] });

    const props = makeProps();
    render(<SearchBar {...props} />);

    const input = screen.getByPlaceholderText('Search notes...');

    // Type a query and let it fire
    changeInput(input, 'hello');
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(mockSearch).toHaveBeenCalledTimes(1);

    // Clear the input — onClear() must fire synchronously, no additional onResults call
    const onResultsCallCountBeforeClear = props.onResults.mock.calls.length;
    act(() => { changeInput(input, ''); });
    expect(props.onClear).toHaveBeenCalledTimes(1);
    // onResults must not have been called again on clear
    expect(props.onResults.mock.calls.length).toBe(onResultsCallCountBeforeClear);

    // Advance past debounce to ensure no second API call was made
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it('shows a loading indicator while search is in flight', async () => {
    let resolveSearch;
    mockSearch.mockImplementation(
      () => new Promise((resolve) => { resolveSearch = resolve; })
    );

    const props = makeProps();
    render(<SearchBar {...props} />);

    const input = screen.getByPlaceholderText('Search notes...');
    changeInput(input, 'hello');

    // Fire debounce — the mock is pending so isLoading becomes true
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('search-loading')).toBeDefined();

    // Resolve the search and confirm loading indicator disappears
    await act(async () => {
      resolveSearch({ results: [] });
    });

    expect(screen.queryByTestId('search-loading')).toBeNull();
  });

  it('forwards ref to the input element', () => {
    const ref = createRef();
    const props = makeProps();
    render(<SearchBar ref={ref} {...props} />);

    expect(ref.current).not.toBeNull();
    expect(ref.current.tagName).toBe('INPUT');
  });

  it('calls onError when search API fails', async () => {
    const apiError = new Error('Network error');
    mockSearch.mockRejectedValue(apiError);

    const props = makeProps();
    render(<SearchBar {...props} />);

    const input = screen.getByPlaceholderText('Search notes...');
    changeInput(input, 'hello');

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(props.onError).toHaveBeenCalledWith(apiError);
  });

  it('does not throw when onError is not provided and search fails', async () => {
    const apiError = new Error('Network error');
    mockSearch.mockRejectedValue(apiError);

    const onResults = vi.fn();
    render(<SearchBar onResults={onResults} />);

    const input = screen.getByPlaceholderText('Search notes...');
    changeInput(input, 'hello');

    // Should not throw; onResults should not be called on error path
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onResults).not.toHaveBeenCalled();
  });

  it('resets debounce timer on each input change', async () => {
    mockSearch.mockResolvedValue({ results: [] });

    const props = makeProps();
    render(<SearchBar {...props} />);

    const input = screen.getByPlaceholderText('Search notes...');

    // First change: advance 200ms (less than 300ms debounce)
    changeInput(input, 'h');
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(mockSearch).not.toHaveBeenCalled();

    // Second change resets the timer
    changeInput(input, 'hi');
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(mockSearch).not.toHaveBeenCalled();

    // Advance the remaining 100ms — debounce fires for the second change
    await act(async () => { vi.advanceTimersByTime(100); });

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith('hi');
  });
});
