/**
 * TagInput component.
 *
 * Inline tag add/remove UI shown in the editor panel when a note is active.
 * Displays existing tags as TagChip components with × remove buttons. A text
 * input allows typing a tag name; submitting with Enter or a comma character
 * calls addTagToNote with the trimmed name. Comma input strips the trailing
 * comma and submits.
 *
 * Validation rules (matching backend constraints):
 *   - Tag name must not be empty after trimming
 *   - Tag name must not contain spaces
 *   - Tag name must not exceed 50 characters
 * Invalid names show an inline error message and do not call the API.
 *
 * The component is intentionally uncontrolled for the input value (local state
 * only) — the canonical tag list is owned by the parent (WorkspacePage) via
 * the existingTags prop.
 */

import React, { useState } from 'react';
import TagChip from './TagChip.jsx';
import { addTagToNote, removeTagFromNote } from '../../api/tags.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a candidate tag name against the rules enforced by the backend.
 *
 * @param {string} name - Trimmed tag name string
 * @returns {string|null} An error message if invalid, or null if valid
 */
function validateTagName(name) {
  if (!name) {
    return 'Tag name cannot be empty.';
  }
  if (/\s/.test(name)) {
    return 'Tag name must not contain spaces.';
  }
  if (name.length > 50) {
    return 'Tag name must be 50 characters or fewer.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Inline tag add/remove UI for the editor panel.
 *
 * @param {object} props
 * @param {string} props.noteId - UUID of the currently open note
 * @param {Array<{ id: string, name: string }>} props.existingTags - Tags currently on the note
 * @param {function} props.onTagAdded - Called with the new tag object after a successful add
 * @param {function} props.onTagRemoved - Called with the removed tag's id after a successful remove
 * @returns {JSX.Element}
 */
function TagInput({ noteId, existingTags, onTagAdded, onTagRemoved }) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);

  /**
   * Attempts to add the given name as a tag on the current note.
   * Validates first; on success clears the input and error, then invokes
   * the onTagAdded callback. On API failure, surfaces a generic error.
   *
   * @param {string} name - Raw (untrimmed) tag name from the input
   */
  async function submitTag(name) {
    const trimmed = name.trim();
    const validationError = validateTagName(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      const result = await addTagToNote(noteId, { name: trimmed });
      setInputValue('');
      onTagAdded(result.tag);
    } catch (err) {
      setError(err.message || 'Failed to add tag.');
    }
  }

  /**
   * Handles keydown events on the tag input.
   * Enter submits the current input value as a tag.
   *
   * @param {React.KeyboardEvent<HTMLInputElement>} e
   */
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitTag(inputValue);
    }
  }

  /**
   * Handles input change events. When a comma is typed, the text before the
   * comma is submitted as a tag and the input is cleared.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e
   */
  function handleChange(e) {
    const value = e.target.value;
    if (value.endsWith(',')) {
      submitTag(value.slice(0, -1));
      setInputValue('');
    } else {
      setInputValue(value);
      if (error) {
        setError(null);
      }
    }
  }

  /**
   * Removes a tag from the note by calling the API and notifying the parent.
   * Silently ignores API failures to avoid blocking the UI.
   *
   * @param {string} tagId - UUID of the tag to remove
   */
  async function handleRemove(tagId) {
    try {
      await removeTagFromNote(noteId, tagId);
      onTagRemoved(tagId);
    } catch {
      // Removal failure is non-fatal; parent state is not updated.
    }
  }

  return (
    <div data-testid="tag-input" className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-border bg-bg-secondary">
      {existingTags.map((tag) => (
        <TagChip key={tag.id} tag={tag} onRemove={handleRemove} />
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Add tag…"
        className="text-xs font-mono bg-transparent text-text-primary outline-none placeholder-text-muted min-w-0 flex-1"
        aria-label="Add tag"
      />
      {error && (
        <span
          data-testid="tag-input-error"
          className="w-full text-xs text-error font-mono mt-0.5"
        >
          {error}
        </span>
      )}
    </div>
  );
}

export default TagInput;
