/**
 * TagFilter component.
 *
 * Renders a "Filter by tag" section in the sidebar. Each tag is a clickable
 * chip; selected tags are highlighted with the accent colour. Clicking a tag
 * calls onToggle(tagId). When no tags are present, the component renders
 * nothing (hidden).
 *
 * A "Clear filters" button appears when one or more tags are selected; clicking
 * it signals onToggle(null), which the parent interprets as "clear all".
 *
 * Design tokens (ADR-008):
 *   Unselected: bg-bg-tertiary border border-border text-text-secondary text-xs px-2 py-0.5 rounded-sm
 *   Selected:   bg-accent text-white border border-accent text-xs px-2 py-0.5 rounded-sm
 */

import React from 'react';

/**
 * Sidebar tag filter section.
 *
 * @param {object} props
 * @param {Array<{ id: string, name: string }>} props.tags - All available user tags
 * @param {string[]} props.selectedTagIds - IDs of currently active tag filters
 * @param {function} props.onToggle - Called with tagId to toggle a filter, or null to clear all
 * @returns {JSX.Element|null} Returns null when tags is empty (hidden)
 */
function TagFilter({ tags, selectedTagIds, onToggle }) {
  if (!tags || tags.length === 0) {
    return null;
  }

  const hasActiveFilters = selectedTagIds.length > 0;

  return (
    <div data-testid="tag-filter" className="px-2 py-2 border-b border-border">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-text-muted uppercase tracking-wide">
          Filter by tag
        </span>
        {hasActiveFilters && (
          <button
            data-testid="clear-filters-button"
            type="button"
            onClick={() => onToggle(null)}
            className="text-xs font-mono text-text-secondary hover:text-text-primary"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          const chipClass = isSelected
            ? 'bg-accent text-white border border-accent text-xs px-2 py-0.5 rounded-sm cursor-pointer'
            : 'bg-bg-tertiary border border-border text-text-secondary text-xs px-2 py-0.5 rounded-sm cursor-pointer hover:border-text-secondary';
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(tag.id)}
              className={chipClass}
              aria-pressed={isSelected}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TagFilter;
