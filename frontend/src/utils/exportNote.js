/**
 * exportNote utility — client-side Markdown file download (TASK-026).
 *
 * Triggers a browser download of a note's raw Markdown content as a .md file.
 * No backend round-trip is required: the note content is already available in
 * editor state when this function is called.
 *
 * The filename is derived from the note title using sanitizeFilename:
 *   1. Lowercase the entire title.
 *   2. Replace every character not in [a-z0-9] with a hyphen.
 *   3. Collapse runs of multiple hyphens into a single hyphen.
 *   4. Trim leading and trailing hyphens.
 *   5. Truncate to 100 characters (before adding the .md extension).
 *   6. If the result is empty, use "untitled" as the filename stem.
 *
 * Download mechanism:
 *   - new Blob([body], { type: 'text/markdown' })
 *   - URL.createObjectURL(blob)
 *   - Hidden <a download="filename.md"> element: appended, clicked, removed
 *   - URL.revokeObjectURL(url) — called immediately after the click to
 *     prevent memory leaks (the browser queues the download before revocation)
 *
 * @module exportNote
 */

const MAX_FILENAME_LENGTH = 100;
const FALLBACK_FILENAME = 'untitled';

/**
 * Sanitizes a note title to produce a filesystem-safe filename stem (without
 * the .md extension).
 *
 * Steps applied in order:
 *   1. Lowercase
 *   2. Replace every character not in [a-z0-9] with a hyphen
 *   3. Collapse runs of multiple hyphens into one
 *   4. Trim leading and trailing hyphens
 *   5. Truncate to MAX_FILENAME_LENGTH characters
 *   6. Trim again after truncation (in case truncation exposed a trailing hyphen)
 *   7. Fall back to FALLBACK_FILENAME if the result is empty
 *
 * @param {string} title - Raw note title (may contain special characters or spaces)
 * @returns {string} Filesystem-safe filename stem. Never empty — falls back to
 *   'untitled' when the title produces an empty string after sanitization.
 *
 * @postcondition Return value contains only lowercase alphanumeric characters
 *   and hyphens
 * @postcondition Return value length is at most MAX_FILENAME_LENGTH
 * @postcondition Return value is never empty
 */
export function sanitizeFilename(title) {
  const lowercased = title.toLowerCase();
  const hyphenated = lowercased.replace(/[^a-z0-9]+/g, '-');
  const collapsed = hyphenated.replace(/-{2,}/g, '-');
  const trimmed = collapsed.replace(/^-+|-+$/g, '');
  const truncated = trimmed.slice(0, MAX_FILENAME_LENGTH);
  const trimmedAfterTruncation = truncated.replace(/^-+|-+$/g, '');

  return trimmedAfterTruncation.length > 0 ? trimmedAfterTruncation : FALLBACK_FILENAME;
}

/**
 * Triggers a client-side browser download of the note body as a .md file.
 *
 * Creates a Blob from the raw Markdown body, generates a temporary object URL,
 * programmatically clicks a hidden anchor element to initiate the download,
 * then immediately revokes the object URL to release memory.
 *
 * @param {string} title - Note title, used to derive the download filename.
 * @param {string} body - Raw Markdown content to write to the file. An empty
 *   string is valid and produces an empty .md file (no error).
 * @returns {void}
 *
 * @precondition This function must be called in a browser context that provides
 *   Blob, URL.createObjectURL, URL.revokeObjectURL, and document.createElement
 * @postcondition A .md file download is initiated in the browser with the
 *   correct filename and text/markdown content type
 * @postcondition The object URL is revoked after the download is triggered to
 *   prevent memory leaks
 */
export function exportNote(title, body) {
  const filename = sanitizeFilename(title) + '.md';
  const blob = new Blob([body], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}
