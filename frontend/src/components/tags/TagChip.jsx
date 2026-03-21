/**
 * TagChip component.
 *
 * Renders a single tag as a small pill following the ADR-008 design tokens.
 * When an onRemove callback is provided, a small × button is rendered inside
 * the pill; clicking it calls onRemove with the tag's id.
 *
 * Design tokens (ADR-008):
 *   bg-bg-tertiary border border-border text-text-secondary text-xs px-2 py-0.5 rounded-sm
 */

import React from 'react';

/**
 * A single tag pill.
 *
 * @param {object} props
 * @param {{ id: string, name: string }} props.tag - The tag to display
 * @param {function} [props.onRemove] - Called with tag.id when the × button is clicked.
 *   When omitted, no × button is rendered.
 * @returns {JSX.Element}
 */
function TagChip({ tag, onRemove }) {
  return (
    <span
      data-testid="tag-chip"
      className="inline-flex items-center gap-1 bg-bg-tertiary border border-border text-text-secondary text-xs px-2 py-0.5 rounded-sm"
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${tag.name}`}
          onClick={() => onRemove(tag.id)}
          className="text-text-muted hover:text-error leading-none"
        >
          ×
        </button>
      )}
    </span>
  );
}

export default TagChip;
