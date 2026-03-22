/**
 * ReadingView component.
 *
 * Full-screen, distraction-free Markdown reading mode (TASK-030, REQ-022).
 * Replaces the split-pane WorkspaceLayout when reading mode is active. The
 * sidebar is hidden; navigation between notes uses Previous/Next controls in
 * the minimal toolbar.
 *
 * Layout:
 *   - Full viewport, bg-bg-primary / text-text-primary
 *   - Minimal toolbar at the top with border-b (ADR-008 — no shadows, no rounded
 *     corners beyond rounded-sm, 1px separator)
 *   - Centered content column: max-w-2xl mx-auto, generous padding/line spacing
 *   - Rendered HTML injected via dangerouslySetInnerHTML (safe: html: false)
 *
 * Security:
 *   The same markdown-it instance as Preview.jsx is imported and reused.
 *   html: false is configured on the singleton — raw HTML tags are escaped, not
 *   executed. dangerouslySetInnerHTML is safe under this constraint.
 *
 * Navigation:
 *   The notes array is the catalog order (updated_at DESC). The current note's
 *   index determines which of prev/next are available. onNavigate is called with
 *   the adjacent note's id. Boundary notes disable the respective button.
 *
 * @param {object} props
 * @param {{ id: string, title: string, body: string|null }} props.note
 *   The currently displayed note.
 * @param {Array<{ id: string, title: string, body: string }>} props.notes
 *   Full ordered notes array, sorted by updated_at DESC (same as sidebar catalog).
 * @param {function} props.onExit
 *   Callback invoked when the user clicks the exit button.
 * @param {function} props.onNavigate
 *   Callback invoked with the target note id when the user clicks prev/next.
 *
 * @precondition props.note is not null
 * @precondition props.notes contains props.note (matched by id)
 * @postcondition Rendered HTML matches markdown-it output with html: false
 * @postcondition Previous button is disabled when note is first in notes array
 * @postcondition Next button is disabled when note is last in notes array
 * @postcondition onExit is called when the exit button is clicked
 * @postcondition onNavigate is called with the adjacent note id when prev/next is clicked
 */

import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';

/**
 * Module-level markdown-it singleton — stateless and safe to share across
 * renders. Configuration mirrors Preview.jsx exactly:
 *   html: false      — raw HTML tags escaped (XSS prevention)
 *   linkify: true    — bare URLs converted to clickable links
 *   typographer: true — smart quotes and typographic replacements
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

/**
 * Returns the index of the note with the given id in the notes array.
 * Returns -1 when not found.
 *
 * @param {Array<{ id: string }>} notes
 * @param {string} noteId
 * @returns {number}
 */
function findNoteIndex(notes, noteId) {
  return notes.findIndex((n) => n.id === noteId);
}

/**
 * @param {object} props
 * @param {{ id: string, title: string, body: string|null }} props.note
 * @param {Array<{ id: string }>} props.notes
 * @param {function} props.onExit
 * @param {function} props.onNavigate
 * @returns {JSX.Element}
 */
function ReadingView({ note, notes, onExit, onNavigate }) {
  const currentIndex = useMemo(() => findNoteIndex(notes, note.id), [notes, note.id]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < notes.length - 1;

  /**
   * Converts the note body to HTML. Memoised so rendering work runs only when
   * the body changes, not on every parent re-render.
   */
  const html = useMemo(() => md.render(note.body || ''), [note.body]);

  /**
   * Navigates to the preceding note in catalog order.
   * No-op when the current note is first (button is disabled, but guard kept
   * for defensive correctness).
   */
  function handlePrev() {
    if (!hasPrev) {
      return;
    }
    onNavigate(notes[currentIndex - 1].id);
  }

  /**
   * Navigates to the following note in catalog order.
   * No-op when the current note is last.
   */
  function handleNext() {
    if (!hasNext) {
      return;
    }
    onNavigate(notes[currentIndex + 1].id);
  }

  return (
    <div
      data-testid="reading-view"
      className="fixed inset-0 z-50 bg-bg-primary text-text-primary flex flex-col overflow-hidden"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Minimal toolbar                                                      */}
      {/* border-b separator — ADR-008: no shadows, no rounded corners        */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="reading-toolbar"
        className="flex items-center gap-3 px-4 py-2 border-b border-border bg-bg-secondary flex-shrink-0"
      >
        {/* Previous note */}
        <button
          data-testid="reading-prev-btn"
          type="button"
          onClick={handlePrev}
          disabled={!hasPrev}
          className={`text-sm font-mono px-2 py-1 border border-border transition-colors ${
            hasPrev
              ? 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              : 'text-text-muted opacity-50 cursor-not-allowed'
          }`}
          aria-label="Previous note"
        >
          ← Prev
        </button>

        {/* Note title — centered, takes remaining space */}
        <span className="flex-1 text-sm font-mono text-text-primary text-center truncate">
          {note.title || 'Untitled'}
        </span>

        {/* Next note */}
        <button
          data-testid="reading-next-btn"
          type="button"
          onClick={handleNext}
          disabled={!hasNext}
          className={`text-sm font-mono px-2 py-1 border border-border transition-colors ${
            hasNext
              ? 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              : 'text-text-muted opacity-50 cursor-not-allowed'
          }`}
          aria-label="Next note"
        >
          Next →
        </button>

        {/* Exit button */}
        <button
          data-testid="reading-exit-btn"
          type="button"
          onClick={onExit}
          className="text-sm font-mono text-text-secondary hover:text-text-primary px-2 py-1 border border-border hover:bg-bg-tertiary transition-colors"
          aria-label="Exit reading mode"
        >
          ✕ Exit
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content area                                                         */}
      {/* Centered column with generous line spacing (ADR-008 aesthetic)       */}
      {/* prose prose-sm mirrors the Preview panel exactly (REQ-007 parity)   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="max-w-2xl mx-auto px-8 py-12 prose prose-sm leading-relaxed"
          // Safe: html: false ensures raw HTML tags in the source are escaped.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

export default ReadingView;
