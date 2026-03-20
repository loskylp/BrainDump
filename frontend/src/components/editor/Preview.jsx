/**
 * Preview component.
 *
 * Renders Markdown source as HTML using markdown-it -- the right half of the
 * split-pane workspace (REQ-007). Re-renders on every value change with no
 * perceptible delay (< 100ms, FF-D02).
 *
 * Visual spec (ADR-008):
 *   - Background: bg-primary (#FFFFFF) -- light, contrasts with dark editor
 *   - Font: system font stack (sans-serif) at 14px for prose
 *   - Monospace font for code blocks and inline code in the rendered output
 *   - Padding: 16px (space-md token) on all sides
 *   - No box shadows, no rounded corners on the preview container
 *
 * Security:
 *   markdown-it HTML rendering is off by default (html: false in options).
 *   Raw HTML in Markdown source is escaped, not executed. This prevents XSS
 *   from untrusted note content. The Builder must NOT set html: true.
 *
 * The rendered HTML is injected via dangerouslySetInnerHTML. This is safe
 * because markdown-it's html: false configuration strips HTML tags.
 *
 * The markdown-it instance is created once (module-level singleton) because
 * it is stateless and expensive to instantiate repeatedly.
 */

import React, { useMemo } from 'react';
import MarkdownIt from 'markdown-it';

/**
 * Module-level markdown-it instance. Stateless; safe to share across renders.
 *
 * Options:
 *   html: false      -- raw HTML tags in the source are escaped, not executed (XSS prevention)
 *   linkify: true    -- bare URLs are converted to clickable links
 *   typographer: true -- smart quotes and typographic replacements
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

/**
 * Renders a Markdown string as sanitised HTML in the preview panel.
 *
 * @param {object} props
 * @param {string} props.value - The Markdown source string to render
 * @returns {JSX.Element}
 *
 * @precondition props.value is a string (may be empty; renders empty div)
 * @postcondition Rendered HTML conforms to CommonMark specification
 * @postcondition Raw HTML tags in Markdown source are escaped (html: false)
 * @postcondition Re-render triggered by any change to props.value
 */
function Preview({ value }) {
  /**
   * Converts the Markdown source to HTML. Memoised so the rendering work
   * runs only when value changes, not on every parent re-render.
   */
  const html = useMemo(() => md.render(value || ''), [value]);

  return (
    <div
      data-testid="preview-panel"
      className="h-full p-4 font-sans text-sm text-text-primary overflow-y-auto bg-bg-primary prose-preview"
      // Safe: html: false ensures raw HTML tags in the source are escaped
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default Preview;
