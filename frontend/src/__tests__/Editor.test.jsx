/**
 * Unit tests for the Editor component (TASK-007, TASK-025 AC-4, AC-5).
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
 * For the imperative handle tests (boldSelection / italicSelection), the mock
 * captures the onEditorReady callback and exposes a fake view object so that the
 * Editor's internal dispatch logic can be exercised in isolation from CM6.
 *
 * This lets the tests verify that Editor correctly passes props to CodeMirror
 * and renders the expected container structure, and that the imperative API
 * correctly wraps/unwraps selection text with Markdown bold and italic markers.
 *
 * Visual / styling assertions are intentionally absent from unit tests -- those
 * are verified by the design-token tests (tailwind-tokens.test.js) and
 * integration tests owned by the Verifier.
 */

import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock @uiw/react-codemirror so tests run without real CM6 DOM APIs.
// The mock CodeMirror component renders a testable <textarea> that mirrors
// the value/onChange/readOnly contract expected by the Editor component.
//
// The mock also captures the onCreateEditor callback (if provided) so tests
// can inject a fake EditorView and exercise the imperative handle logic.
// ---------------------------------------------------------------------------

let capturedOnCreateEditor = null;

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn(({ value, onChange, readOnly, onCreateEditor, 'data-testid': testId }) => {
    capturedOnCreateEditor = onCreateEditor || null;
    return (
      <textarea
        data-testid={testId || 'codemirror-mock'}
        defaultValue={value}
        readOnly={readOnly}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    );
  }),
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

// ---------------------------------------------------------------------------
// TASK-025 AC-4, AC-5: imperative handle — boldSelection / italicSelection
//
// The Editor component exposes boldSelection() and italicSelection() via
// useImperativeHandle / forwardRef. These tests build a fake EditorView object
// that records dispatch calls and inject it through the onCreateEditor callback
// captured by the mock above, then assert that the dispatched transactions
// produce the correct text transformations.
// ---------------------------------------------------------------------------

/**
 * Builds a fake CodeMirror EditorView whose state reflects the given text
 * with an optional selection range. Captures dispatch calls so tests can
 * inspect the transaction changes sent to the view.
 *
 * @param {string} doc - The full document text.
 * @param {{ from: number, to: number }} [selection] - Selected range (defaults to cursor at 0).
 * @returns {{ view: object, getDispatched: () => object[] }}
 */
function buildFakeView(doc, selection = { from: 0, to: 0 }) {
  const dispatched = [];

  const view = {
    state: {
      doc: {
        toString: () => doc,
        length: doc.length,
        sliceString: (from, to) => doc.slice(from, to),
      },
      selection: {
        main: { from: selection.from, to: selection.to },
      },
    },
    dispatch: (tr) => dispatched.push(tr),
  };

  return { view, getDispatched: () => dispatched };
}

describe('Editor imperative handle (TASK-025 AC-4, AC-5)', () => {
  beforeEach(() => {
    capturedOnCreateEditor = null;
  });

  /**
   * Renders the Editor with a ref, fires onCreateEditor with the fake view,
   * and returns the ref handle.
   */
  function renderEditorWithFakeView(fakeView) {
    const ref = createRef();
    render(<Editor ref={ref} value="" onChange={vi.fn()} />);
    act(() => {
      if (capturedOnCreateEditor) {
        capturedOnCreateEditor(fakeView, null);
      }
    });
    return ref;
  }

  // -------------------------------------------------------------------------
  // boldSelection
  // -------------------------------------------------------------------------

  describe('boldSelection()', () => {
    it('wraps selected text with ** markers', () => {
      const { view, getDispatched } = buildFakeView('hello world', { from: 0, to: 5 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.boldSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const changes = getDispatched()[0].changes;
      // The dispatched changes object must contain the bold-wrapped replacement
      expect(changes).toBeDefined();
      expect(changes.from).toBe(0);
      expect(changes.to).toBe(5);
      expect(changes.insert).toBe('**hello**');
    });

    it('unwraps already-bolded selection', () => {
      const { view, getDispatched } = buildFakeView('**hello**', { from: 0, to: 9 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.boldSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const changes = getDispatched()[0].changes;
      expect(changes.from).toBe(0);
      expect(changes.to).toBe(9);
      expect(changes.insert).toBe('hello');
    });

    it('inserts **** and positions cursor between markers when nothing is selected', () => {
      const { view, getDispatched } = buildFakeView('', { from: 0, to: 0 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.boldSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const tr = getDispatched()[0];
      expect(tr.changes.insert).toBe('****');
      // Cursor should be positioned between the markers (offset 2 from insertion point)
      expect(tr.selection).toBeDefined();
      expect(tr.selection.anchor).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // italicSelection
  // -------------------------------------------------------------------------

  describe('italicSelection()', () => {
    it('wraps selected text with * markers', () => {
      const { view, getDispatched } = buildFakeView('hello world', { from: 0, to: 5 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.italicSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const changes = getDispatched()[0].changes;
      expect(changes.from).toBe(0);
      expect(changes.to).toBe(5);
      expect(changes.insert).toBe('*hello*');
    });

    it('unwraps already-italicised selection (single * only, not **)', () => {
      const { view, getDispatched } = buildFakeView('*hello*', { from: 0, to: 7 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.italicSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const changes = getDispatched()[0].changes;
      expect(changes.from).toBe(0);
      expect(changes.to).toBe(7);
      expect(changes.insert).toBe('hello');
    });

    it('does NOT unwrap ** (bold) when italic is triggered on **text**', () => {
      // Selecting **hello** and pressing Cmd+I should wrap it in * not unwrap
      const { view, getDispatched } = buildFakeView('**hello**', { from: 0, to: 9 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.italicSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const changes = getDispatched()[0].changes;
      expect(changes.insert).toBe('***hello***');
    });

    it('inserts ** and positions cursor between markers when nothing is selected', () => {
      const { view, getDispatched } = buildFakeView('', { from: 0, to: 0 });
      const ref = renderEditorWithFakeView(view);

      act(() => { ref.current.italicSelection(); });

      expect(getDispatched()).toHaveLength(1);
      const tr = getDispatched()[0];
      expect(tr.changes.insert).toBe('**');
      expect(tr.selection).toBeDefined();
      expect(tr.selection.anchor).toBe(1);
    });
  });
});
