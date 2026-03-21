/**
 * SearchBar component.
 *
 * Renders a text input that triggers full-text search across the
 * authenticated user's notes (REQ-010, ADR-005). Search is executed against
 * the backend's PostgreSQL FTS endpoint (GET /api/search?q=...) via the
 * search API module.
 *
 * Search is triggered by:
 *   - Debounced input change (300ms debounce to avoid excessive requests
 *     while the user is still typing)
 *   - Explicit form submission (Enter key)
 *
 * The Cmd+K / Ctrl+K keyboard shortcut (TASK-025) should focus this input
 * from anywhere in the workspace. To support this, the component accepts a
 * ref forwarded to the <input> element.
 *
 * Results delivery: SearchBar calls onResults with the API response array.
 * It does not render results itself — result presentation is the parent's
 * responsibility (ADR-005: "The UI location of search results is a Builder
 * decision").
 *
 * Visual states:
 *   idle     -> input empty, placeholder text visible
 *   loading  -> input has text, spinner indicator visible (data-testid="search-loading")
 *   results  -> onResults called with array (may be empty)
 *   error    -> onError called (network failure, etc.)
 *
 * Props:
 *   @prop {function} onResults - Called with Array<{ id, title, snippet }>
 *     when search completes successfully. Called with [] when the API returns
 *     zero matches for an active query.
 *   @prop {function} [onClear] - Called with no arguments when the query is
 *     cleared (input becomes empty). Allows the parent to distinguish between
 *     "zero results for a query" and "no active query". Optional.
 *   @prop {function} [onError] - Called with an Error when the search request
 *     fails. Optional; if omitted, errors are silently ignored.
 *   @prop {string} [placeholder='Search notes...'] - Input placeholder text.
 *   @prop {React.Ref} [ref] - Forwarded to the <input> element for focus
 *     control from parent components (e.g., useKeyboardShortcuts).
 */

import { forwardRef, useState, useRef } from 'react';
import { search as searchApi } from '../../api/search.js';

// Debounce delay in milliseconds before a search is fired after a keystroke.
const DEBOUNCE_DELAY_MS = 300;

/**
 * Debounced full-text search input.
 *
 * @param {object} props
 * @param {function} props.onResults - Called with the results array on success
 * @param {function} [props.onClear] - Called when the query is cleared (optional)
 * @param {function} [props.onError] - Called with Error on failure (optional)
 * @param {string} [props.placeholder='Search notes...'] - Input placeholder
 * @param {React.Ref} ref - Forwarded to the underlying <input> element
 * @returns {JSX.Element}
 *
 * @postcondition onClear() is called immediately when query is cleared
 * @postcondition onResults(results) is called after DEBOUNCE_DELAY_MS following input
 * @postcondition isLoading is true while a search request is in flight
 * @postcondition ref.current points to the <input> DOM element
 */
const SearchBar = forwardRef(function SearchBar(
  { onResults, onClear, onError, placeholder = 'Search notes...' },
  ref
) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimer = useRef(null);

  /**
   * Executes the search API call for the given query string.
   * Sets isLoading during the request and calls onResults or onError on completion.
   *
   * @param {string} trimmedQuery - Already-trimmed non-empty search query
   */
  async function executeSearch(trimmedQuery) {
    setIsLoading(true);
    try {
      const data = await searchApi(trimmedQuery);
      onResults(data.results);
    } catch (err) {
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Handles input value changes.
   *
   * When the value is empty after trimming: clears results immediately and
   * cancels any pending debounce timer without firing a search request.
   * When the value is non-empty: resets the debounce timer so the search
   * fires DEBOUNCE_DELAY_MS after the last keystroke.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e
   */
  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);

    // Clear pending debounce on every keystroke
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    if (!value.trim()) {
      if (onClear) {
        onClear();
      }
      return;
    }

    debounceTimer.current = setTimeout(() => {
      executeSearch(value.trim());
    }, DEBOUNCE_DELAY_MS);
  }

  /**
   * Handles form submission (Enter key press).
   * Fires the search immediately, bypassing the debounce delay.
   *
   * @param {React.FormEvent<HTMLFormElement>} e
   */
  function handleSubmit(e) {
    e.preventDefault();

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const trimmed = query.trim();
    if (trimmed) {
      executeSearch(trimmed);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        ref={ref}
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full bg-bg-secondary text-text-primary text-sm font-mono px-3 py-2 border border-border outline-none placeholder-text-secondary focus:border-text-secondary"
        aria-label="Search notes"
      />
      {isLoading && (
        <span
          data-testid="search-loading"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-mono"
          aria-live="polite"
          aria-label="Searching..."
        >
          ...
        </span>
      )}
    </form>
  );
});

export default SearchBar;
