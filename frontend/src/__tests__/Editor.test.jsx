/**
 * Unit tests for the Editor component (TASK-007).
 *
 * CodeMirror 6 relies on browser APIs (ResizeObserver, contenteditable, DOM
 * selection) that jsdom does not fully implement. The @uiw/react-codemirror
 * package is mocked at module level so tests can verify the Editor component's
 * contract (prop wiring, readOnly behaviour, data-testid) without instantiating
 * the real CM6 editor.
 *
 * The mock renders a plain <textarea> that simulates CM6's controlled interface:
 *   - value is bound to the textarea's defaultValue
 *   - onChange is wired to the textarea's onChange event (fires with the new string)
 *   - readOnly maps to the textarea's readOnly attribute
 *
 * This lets the tests verify that Editor correctly passes props to CodeMirror
 * and renders the expected container structure.
 *
 * Visual / styling assertions are intentionally absent from unit tests -- those
 * are verified by the design-token tests (tailwind-tokens.test.js) and
 * integration tests owned by the Verifier.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock @uiw/react-codemirror so tests run without real CM6 DOM APIs.
// The mock CodeMirror component renders a testable <textarea> that mirrors
// the value/onChange/readOnly contract expected by the Editor component.
// ---------------------------------------------------------------------------

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn(({ value, onChange, readOnly, 'data-testid': testId }) => (
    <textarea
      data-testid={testId || 'codemirror-mock'}
      defaultValue={value}
      readOnly={readOnly}
      onChange={(e) => onChange && onChange(e.target.value)}
    />
  )),
}));

// Import after mock is registered
import Editor from '../components/editor/Editor.jsx';

describe('Editor (TASK-007)', () => {
  // -------------------------------------------------------------------------
  // Container structure
  // -------------------------------------------------------------------------

  describe('container structure', () => {
    it('renders a container element for the editor', () => {
      const { container } = render(
        <Editor value="" onChange={vi.fn()} />
      );
      expect(container.firstChild).not.toBeNull();
    });

    it('applies data-testid="editor-panel" on the outer container', () => {
      const { container } = render(
        <Editor value="" onChange={vi.fn()} />
      );
      expect(container.querySelector('[data-testid="editor-panel"]')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Controlled value prop
  // -------------------------------------------------------------------------

  describe('controlled value prop', () => {
    it('passes the value prop to the CodeMirror instance', () => {
      const { container } = render(
        <Editor value="# Hello" onChange={vi.fn()} />
      );
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      expect(cm).not.toBeNull();
      expect(cm.defaultValue).toBe('# Hello');
    });

    it('passes an empty string value without error', () => {
      const { container } = render(
        <Editor value="" onChange={vi.fn()} />
      );
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      expect(cm.defaultValue).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // onChange callback
  // -------------------------------------------------------------------------

  describe('onChange callback', () => {
    it('calls onChange when the editor content changes', () => {
      const handleChange = vi.fn();
      const { container } = render(
        <Editor value="" onChange={handleChange} />
      );
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      fireEvent.change(cm, { target: { value: '# New heading' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith('# New heading');
    });

    it('passes the full updated string to onChange (not an event object)', () => {
      const handleChange = vi.fn();
      const { container } = render(
        <Editor value="initial" onChange={handleChange} />
      );
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      fireEvent.change(cm, { target: { value: 'updated content' } });
      expect(typeof handleChange.mock.calls[0][0]).toBe('string');
      expect(handleChange.mock.calls[0][0]).toBe('updated content');
    });
  });

  // -------------------------------------------------------------------------
  // readOnly prop
  // -------------------------------------------------------------------------

  describe('readOnly prop', () => {
    it('defaults readOnly to false (editor is interactive)', () => {
      const { container } = render(
        <Editor value="" onChange={vi.fn()} />
      );
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      // readOnly=false means the textarea is NOT read-only
      expect(cm.readOnly).toBe(false);
    });

    it('passes readOnly=true to CodeMirror when readOnly prop is true', () => {
      const { container } = render(
        <Editor value="static content" onChange={vi.fn()} readOnly />
      );
      const cm = container.querySelector('[data-testid="codemirror-mock"]');
      expect(cm.readOnly).toBe(true);
    });
  });
});
