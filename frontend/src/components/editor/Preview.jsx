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
 *   - Left border: 1px solid border (#DEE2E6) -- panel divider from editor
 *   - No box shadows, no rounded corners on the preview container
 *
 * Security:
 *   markdown-it HTML rendering is off by default (html: false in options).
 *   Raw HTML in Markdown source is escaped, not executed. This prevents XSS
 *   from untrusted note content. The Builder must NOT set html: true.
 *
 * The rendered HTML is injected via dangerouslySetInnerHTML. This is safe
 * because markdown-it's html: false configuration strips HTML tags.
 */

// TODO: TASK-007
import React, { useMemo } from 'react';

/**
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
  // TODO: TASK-007 -- implement using markdown-it with html: false, linkify: true, typographer: true
  // Use useMemo to avoid re-creating the MarkdownIt instance on each render
  return null;
}

export default Preview;
