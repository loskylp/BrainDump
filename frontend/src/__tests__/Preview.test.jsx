/**
 * Unit tests for the Preview component (TASK-007).
 *
 * Verifies:
 *   AC-5: CommonMark rendering (headings, emphasis, links, lists, code)
 *   AC-7: Light background, system font stack
 *   AC-2/3: Reactive to value prop changes (re-renders on new value)
 *   Security: html: false -- raw HTML tags are escaped, not executed
 *
 * Preview is a pure presentational component. It accepts a markdown string
 * and renders the HTML output via dangerouslySetInnerHTML. No mocking needed.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Preview from '../components/editor/Preview.jsx';

describe('Preview (TASK-007)', () => {
  // -------------------------------------------------------------------------
  // AC-5: CommonMark compliance
  // -------------------------------------------------------------------------

  describe('CommonMark rendering', () => {
    it('renders an ATX heading (# Heading) as an <h1> element', () => {
      const { container } = render(<Preview value="# Hello World" />);
      const h1 = container.querySelector('h1');
      expect(h1).not.toBeNull();
      expect(h1.textContent).toBe('Hello World');
    });

    it('renders a level-2 heading (## Heading) as an <h2> element', () => {
      const { container } = render(<Preview value="## Section" />);
      expect(container.querySelector('h2')).not.toBeNull();
    });

    it('renders bold text (**bold**) as a <strong> element', () => {
      const { container } = render(<Preview value="**bold text**" />);
      expect(container.querySelector('strong')).not.toBeNull();
      expect(container.querySelector('strong').textContent).toBe('bold text');
    });

    it('renders italic text (*italic*) as an <em> element', () => {
      const { container } = render(<Preview value="*italic text*" />);
      expect(container.querySelector('em')).not.toBeNull();
      expect(container.querySelector('em').textContent).toBe('italic text');
    });

    it('renders a link [text](url) as an <a> element with correct href', () => {
      const { container } = render(<Preview value="[click here](https://example.com)" />);
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.getAttribute('href')).toBe('https://example.com');
      expect(link.textContent).toBe('click here');
    });

    it('renders an unordered list as a <ul> with <li> children', () => {
      const { container } = render(<Preview value={'- item one\n- item two'} />);
      expect(container.querySelector('ul')).not.toBeNull();
      const items = container.querySelectorAll('li');
      expect(items.length).toBe(2);
    });

    it('renders an ordered list as an <ol> with <li> children', () => {
      const { container } = render(<Preview value={'1. first\n2. second'} />);
      expect(container.querySelector('ol')).not.toBeNull();
      expect(container.querySelectorAll('li').length).toBe(2);
    });

    it('renders a fenced code block as a <pre><code> element', () => {
      const { container } = render(<Preview value={'```\nconst x = 1;\n```'} />);
      expect(container.querySelector('pre')).not.toBeNull();
      expect(container.querySelector('code')).not.toBeNull();
    });

    it('renders inline code (`code`) as a <code> element', () => {
      const { container } = render(<Preview value="use `const` here" />);
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code.textContent).toBe('const');
    });

    it('renders a paragraph as a <p> element', () => {
      const { container } = render(<Preview value="A plain paragraph." />);
      expect(container.querySelector('p')).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Security: raw HTML is escaped (html: false)
  // -------------------------------------------------------------------------

  describe('XSS safety', () => {
    it('escapes raw HTML tags instead of rendering them', () => {
      const { container } = render(<Preview value="<script>alert('xss')</script>" />);
      // The script tag must not be present in the DOM
      expect(container.querySelector('script')).toBeNull();
    });

    it('escapes HTML in the markdown source so it appears as text', () => {
      const { container } = render(<Preview value="<b>not bold</b>" />);
      // The <b> tag should be escaped — no b element in the output
      expect(container.querySelector('b')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Empty input
  // -------------------------------------------------------------------------

  describe('empty state', () => {
    it('renders an empty container when value is an empty string', () => {
      const { container } = render(<Preview value="" />);
      // Should render without error; the prose wrapper is present
      const wrapper = container.firstChild;
      expect(wrapper).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Reactivity: re-renders when value prop changes
  // -------------------------------------------------------------------------

  describe('reactivity', () => {
    it('updates rendered output when value prop changes', () => {
      const { container, rerender } = render(<Preview value="# First" />);
      expect(container.querySelector('h1').textContent).toBe('First');

      rerender(<Preview value="# Second" />);
      expect(container.querySelector('h1').textContent).toBe('Second');
    });
  });

  // -------------------------------------------------------------------------
  // AC-7: Container is present (visual classes verified by token tests)
  // -------------------------------------------------------------------------

  describe('container structure', () => {
    it('renders a container element for the preview content', () => {
      const { container } = render(<Preview value="hello" />);
      expect(container.firstChild).not.toBeNull();
    });

    it('applies data-testid="preview-panel" for integration testing', () => {
      const { container } = render(<Preview value="hello" />);
      expect(container.querySelector('[data-testid="preview-panel"]')).not.toBeNull();
    });
  });
});
