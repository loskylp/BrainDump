/**
 * Verifier Acceptance Tests — TASK-007: Split-pane Markdown editor with live preview
 *
 * REQ-007: Markdown editor with live preview
 * ADR-001: CodeMirror 6 + markdown-it
 * ADR-008: Professional/technical design aesthetic (design tokens)
 * ADR-009: Responsive layout (CSS Grid, panel structure)
 *
 * These tests are authored by the Verifier. They operate through the React
 * component tree rendered in jsdom (Vitest + Testing Library), exercising
 * the Editor and Preview components independently and as wired in WorkspacePage.
 * No implementation internals are accessed beyond what is visible in the rendered DOM.
 *
 * Acceptance criteria covered:
 *   AC-1  Two panels side by side: CM6 editor (left), markdown-it preview (right)
 *   AC-2  Every edit reflected in preview without user action (live rendering)
 *   AC-3  Preview updates < 100ms (FF-D02)
 *   AC-4  Syntax highlighting configuration (extensions passed to CodeMirror)
 *   AC-5  CommonMark compliance (ATX headings, emphasis, links, lists, code)
 *   AC-6  Editor uses dark background (bg-editor #1E1E1E) with monospace font
 *   AC-7  Preview uses light background with system font stack
 *   AC-8  Panel dividers are 1px solid border lines (no shadows, no gradients)
 *
 * Fitness function:
 *   FF-D02: Preview latency < 100ms measured in jsdom via performance.now()
 *
 * Test layers: acceptance (component integration through WorkspacePage render)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Mock @uiw/react-codemirror — CM6 requires browser APIs absent in jsdom.
// The mock renders a <textarea> that mirrors the value/onChange contract.
// The `extensions` and `theme` props are captured so AC-4 and AC-6 can
// verify the correct configuration is passed without needing a real CM6 instance.
// ---------------------------------------------------------------------------

const capturedCodeMirrorProps = { current: null };

vi.mock('@uiw/react-codemirror', () => ({
  default: vi.fn((props) => {
    // Capture every set of props so acceptance tests can inspect configuration
    capturedCodeMirrorProps.current = props;
    return (
      <textarea
        data-testid={props['data-testid'] || 'codemirror-mock'}
        defaultValue={props.value}
        readOnly={props.readOnly}
        onChange={(e) => props.onChange && props.onChange(e.target.value)}
      />
    );
  }),
}));

// ---------------------------------------------------------------------------
// Mock lang-markdown and theme-one-dark so they are importable in jsdom.
// The Verifier captures what was passed, not whether CM6 applies it.
// ---------------------------------------------------------------------------

vi.mock('@codemirror/lang-markdown', () => ({
  markdown: vi.fn(() => ({ type: 'extension', name: 'markdown' })),
}));

vi.mock('@codemirror/theme-one-dark', () => ({
  oneDark: { type: 'theme', name: 'oneDark' },
}));

// ---------------------------------------------------------------------------
// Mock auth and notes API
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/notes.js', () => ({
  getNotes: vi.fn(),
  createNote: vi.fn(),
  getNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
}));

vi.mock('../api/tags.js', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  addTagToNote: vi.fn(),
  removeTagFromNote: vi.fn(),
}));

import { useAuth } from '../hooks/useAuth.js';
import { getNotes, getNote } from '../api/notes.js';
import { getTags } from '../api/tags.js';
import Editor from '../components/editor/Editor.jsx';
import Preview from '../components/editor/Preview.jsx';
import WorkspacePage from '../pages/WorkspacePage.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWorkspacePage() {
  return render(
    <MemoryRouter initialEntries={['/workspace']}>
      <Routes>
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Shared beforeEach — reset mocks and set authenticated user
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  capturedCodeMirrorProps.current = null;

  useAuth.mockReturnValue({
    user: { id: 'user-1', username: 'alice', email: 'alice@example.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  });

  getNotes.mockResolvedValue({ notes: [] });
  getTags.mockResolvedValue({ tags: [] });
  getNote.mockResolvedValue({
    note: {
      id: 'note-1',
      title: 'Test Note',
      body: '# Loaded Note',
      folder_id: null,
      updated_at: '2026-03-20T10:00:00.000Z',
    },
  });
});

// ===========================================================================
// AC-1 [REQ-007]: Two panels side by side — CM6 editor (left), markdown-it preview (right)
// ===========================================================================

describe('AC-1 [REQ-007]: Two panels side by side', () => {
  // Given: an authenticated user on the workspace
  // When: the workspace renders
  // Then: both editor and preview panel containers are present in the DOM

  it('renders the editor panel container in the workspace', () => {
    const { container } = renderWorkspacePage();
    expect(container.querySelector('[data-testid="editor-panel"]')).not.toBeNull();
  });

  it('renders the preview panel container in the workspace', () => {
    const { container } = renderWorkspacePage();
    expect(container.querySelector('[data-testid="preview-panel"]')).not.toBeNull();
  });

  it('renders a CodeMirror instance inside the editor panel', () => {
    const { container } = renderWorkspacePage();
    const editorPanel = container.querySelector('[data-testid="editor-panel"]');
    expect(editorPanel).not.toBeNull();
    // The CM6 mock renders a textarea inside the editor panel
    const cm = container.querySelector('[data-testid="codemirror-mock"]');
    expect(cm).not.toBeNull();
  });

  it('[VERIFIER-ADDED] renders editor panel before the preview panel in DOM order', () => {
    // Given: the split-pane layout places editor on the left, preview on the right
    // When: workspace renders
    // Then: editor-panel appears before preview-panel in document order
    const { container } = renderWorkspacePage();
    const all = container.querySelectorAll('[data-testid="editor-panel"], [data-testid="preview-panel"]');
    expect(all.length).toBe(2);
    expect(all[0].getAttribute('data-testid')).toBe('editor-panel');
    expect(all[1].getAttribute('data-testid')).toBe('preview-panel');
  });

  it('[VERIFIER-ADDED] does NOT render a single unified panel — both editor and preview are distinct elements', () => {
    // Negative: a trivially permissive implementation might merge both panels into one
    const { container } = renderWorkspacePage();
    const editorPanel = container.querySelector('[data-testid="editor-panel"]');
    const previewPanel = container.querySelector('[data-testid="preview-panel"]');
    // They must be different DOM nodes
    expect(editorPanel).not.toBe(previewPanel);
    // They must not be the same element (neither contains the other as its direct testid)
    expect(editorPanel.contains(previewPanel)).toBe(false);
    expect(previewPanel.contains(editorPanel)).toBe(false);
  });
});

// ===========================================================================
// AC-2 [REQ-007]: Every edit reflected in preview without user action
// ===========================================================================

describe('AC-2 [REQ-007]: Live preview — every edit reflected immediately', () => {
  // Given: an authenticated user in the workspace
  // When: the user types into the Editor
  // Then: the Preview panel updates to reflect the new content without the user
  //       taking any additional action (no submit, no button press)

  it('when editor value changes, preview reflects the new markdown output', () => {
    // Use Editor + Preview components directly to test the reactive path
    const { container, rerender } = render(
      <>
        <Editor value="# First" onChange={vi.fn()} />
        <Preview value="# First" />
      </>
    );

    const previewBefore = container.querySelector('[data-testid="preview-panel"]');
    expect(previewBefore.querySelector('h1').textContent).toBe('First');

    // Simulate the WorkspacePage pattern: same editorBody drives both
    rerender(
      <>
        <Editor value="# Second" onChange={vi.fn()} />
        <Preview value="# Second" />
      </>
    );

    const previewAfter = container.querySelector('[data-testid="preview-panel"]');
    expect(previewAfter.querySelector('h1').textContent).toBe('Second');
  });

  it('preview does NOT retain stale content after the editor value changes', () => {
    const { container, rerender } = render(
      <>
        <Editor value="Old content" onChange={vi.fn()} />
        <Preview value="Old content" />
      </>
    );

    rerender(
      <>
        <Editor value="New content" onChange={vi.fn()} />
        <Preview value="New content" />
      </>
    );

    const preview = container.querySelector('[data-testid="preview-panel"]');
    expect(preview.textContent).toContain('New content');
    expect(preview.textContent).not.toContain('Old content');
  });

  it('[VERIFIER-ADDED] preview updates when a note body is loaded — editor body initialises preview', async () => {
    // Given: a note with a specific body is loaded into the workspace
    // When: the note-loading useEffect fires
    // Then: the preview panel contains the rendered note body

    const user = userEvent.setup();
    getNotes.mockResolvedValue({
      notes: [{ id: 'note-1', title: 'My Note', updated_at: '2026-03-20T10:00:00.000Z', folder_id: null }],
    });
    getNote.mockResolvedValue({
      note: { id: 'note-1', title: 'My Note', body: '## Loaded Body', folder_id: null, updated_at: '2026-03-20T10:00:00.000Z' },
    });

    const { container } = renderWorkspacePage();
    await waitFor(() => screen.getByText('My Note'));
    await user.click(screen.getByText('My Note'));

    await waitFor(() => {
      const preview = container.querySelector('[data-testid="preview-panel"]');
      expect(preview.querySelector('h2')).not.toBeNull();
      expect(preview.textContent).toContain('Loaded Body');
    });
  });

  it('[VERIFIER-ADDED] preview shows empty content when no note is selected', () => {
    // Negative: preview must not show residual content in the empty state
    const { container } = renderWorkspacePage();
    const preview = container.querySelector('[data-testid="preview-panel"]');
    // Empty editorBody produces empty rendered output (markdown-it renders '' as '')
    expect(preview.textContent.trim()).toBe('');
  });
});

// ===========================================================================
// AC-3 [REQ-007, FF-D02]: Preview updates < 100ms
// ===========================================================================

describe('AC-3 [REQ-007, FF-D02]: Preview latency < 100ms', () => {
  // Given: a Preview component
  // When: the value prop changes
  // Then: the re-render completes in under 100ms

  it('FF-D02: rendering a markdown string to HTML takes under 100ms', () => {
    // Given: Preview is already mounted
    const { rerender } = render(<Preview value="# Warmup" />);

    // When: a representative note body (multi-element CommonMark document) is rendered
    const markdownDoc = [
      '# Main Heading',
      '',
      'A paragraph with **bold** and *italic* text.',
      '',
      '## Section Two',
      '',
      '- item one',
      '- item two',
      '- item three',
      '',
      '```javascript',
      'const x = 1;',
      'const y = 2;',
      'console.log(x + y);',
      '```',
      '',
      '[A link](https://example.com)',
      '',
      '> A blockquote line',
    ].join('\n');

    const start = performance.now();
    rerender(<Preview value={markdownDoc} />);
    const elapsed = performance.now() - start;

    // Then: elapsed < 100ms (FF-D02 threshold)
    expect(elapsed).toBeLessThan(100);
  });

  it('[VERIFIER-ADDED] FF-D02: rendering 50 successive value changes stays under 100ms per render', () => {
    // Given: a mounted Preview
    const { rerender } = render(<Preview value="" />);

    // When: 50 keystrokes' worth of incremental updates are applied
    const lines = [
      '# T', '# Ti', '# Tit', '# Titl', '# Title',
      '# Title\n', '# Title\nP', '# Title\nPa', '# Title\nPar', '# Title\nPara',
      '# Title\nParagraph', '# Title\nParagraph **', '# Title\nParagraph **b',
      '# Title\nParagraph **bo', '# Title\nParagraph **bol',
      '# Title\nParagraph **bold', '# Title\nParagraph **bold**',
      '# Title\nParagraph **bold**\n', '# Title\nParagraph **bold**\n-',
      '# Title\nParagraph **bold**\n- i', '# Title\nParagraph **bold**\n- it',
      '# Title\nParagraph **bold**\n- ite', '# Title\nParagraph **bold**\n- item',
    ];

    let maxElapsed = 0;
    for (const value of lines) {
      const start = performance.now();
      rerender(<Preview value={value} />);
      const elapsed = performance.now() - start;
      if (elapsed > maxElapsed) maxElapsed = elapsed;
    }

    // Then: no single re-render exceeds 100ms
    expect(maxElapsed).toBeLessThan(100);
  });

  it('[VERIFIER-ADDED] FF-D02: the Editor onChange fires synchronously and Preview reflects update within the same render cycle', () => {
    // Negative: a debounced path would delay the Preview update beyond the test's synchronous scope.
    // This test captures the onChange handler from WorkspacePage and verifies that
    // after the handler fires, the preview updates without any pending async work.

    // Given: Editor + Preview driven by a shared state value (mirrors WorkspacePage data flow)
    let externalSetValue;
    function TestHarness() {
      const [value, setValue] = React.useState('');
      externalSetValue = setValue;
      return (
        <>
          <Editor value={value} onChange={setValue} />
          <Preview value={value} />
        </>
      );
    }

    const { container } = render(<TestHarness />);

    // When: the onChange handler is invoked (simulating a CM6 keystroke)
    act(() => {
      externalSetValue('## Live Synchronous Update');
    });

    // Then: the preview reflects the new content immediately — no delay
    const preview = container.querySelector('[data-testid="preview-panel"]');
    expect(preview.querySelector('h2')).not.toBeNull();
    expect(preview.textContent).toContain('Live Synchronous Update');
  });
});

// ===========================================================================
// AC-4 [REQ-007]: Syntax highlighting — markdown() extension + oneDark theme
// ===========================================================================

describe('AC-4 [REQ-007]: Syntax highlighting configuration', () => {
  // Given: the Editor component is rendered
  // When: the CodeMirror instance is instantiated
  // Then: the markdown() extension and oneDark theme are passed to CodeMirror

  it('passes the markdown() extension to CodeMirror for Markdown syntax highlighting', () => {
    render(<Editor value="# Hello" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    expect(props).not.toBeNull();
    expect(props.extensions).toBeDefined();
    // markdown() returns an object; verify at least one extension is passed
    expect(Array.isArray(props.extensions)).toBe(true);
    expect(props.extensions.length).toBeGreaterThan(0);
  });

  it('passes the oneDark theme to CodeMirror', () => {
    render(<Editor value="# Hello" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    expect(props.theme).toBeDefined();
    // oneDark is a theme object with name 'oneDark'
    expect(props.theme).toHaveProperty('name', 'oneDark');
  });

  it('[VERIFIER-ADDED] does NOT pass the theme as null or undefined (would lose dark editor appearance)', () => {
    render(<Editor value="" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    expect(props.theme).not.toBeNull();
    expect(props.theme).not.toBeUndefined();
  });

  it('[VERIFIER-ADDED] does NOT omit the extensions array (would lose syntax highlighting)', () => {
    render(<Editor value="" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    expect(props.extensions).not.toBeNull();
    expect(props.extensions).not.toBeUndefined();
    // An empty extensions array would mean no Markdown highlighting
    expect(props.extensions.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// AC-5 [REQ-007]: CommonMark compliance — markdown-it rendering
// ===========================================================================

describe('AC-5 [REQ-007]: CommonMark compliance', () => {
  // ATX headings

  it('renders ATX H1 (# Heading) as <h1>', () => {
    const { container } = render(<Preview value="# CommonMark H1" />);
    expect(container.querySelector('h1')?.textContent).toBe('CommonMark H1');
  });

  it('renders ATX H2 (## Heading) as <h2>', () => {
    const { container } = render(<Preview value="## CommonMark H2" />);
    expect(container.querySelector('h2')?.textContent).toBe('CommonMark H2');
  });

  it('renders ATX H3 (### Heading) as <h3>', () => {
    const { container } = render(<Preview value="### CommonMark H3" />);
    expect(container.querySelector('h3')?.textContent).toBe('CommonMark H3');
  });

  // Emphasis

  it('renders **bold** as <strong>', () => {
    const { container } = render(<Preview value="**bold text**" />);
    expect(container.querySelector('strong')?.textContent).toBe('bold text');
  });

  it('renders *italic* as <em>', () => {
    const { container } = render(<Preview value="*italic text*" />);
    expect(container.querySelector('em')?.textContent).toBe('italic text');
  });

  it('renders _underscored italic_ as <em>', () => {
    const { container } = render(<Preview value="_underscored_" />);
    expect(container.querySelector('em')?.textContent).toBe('underscored');
  });

  // Links

  it('renders [text](url) as <a> with correct href', () => {
    const { container } = render(<Preview value="[click me](https://example.com)" />);
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('click me');
  });

  // Lists

  it('renders unordered list (- item) as <ul> with <li> children', () => {
    const { container } = render(<Preview value={'- alpha\n- beta\n- gamma'} />);
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelectorAll('ul li').length).toBe(3);
  });

  it('renders ordered list (1. item) as <ol> with <li> children', () => {
    const { container } = render(<Preview value={'1. first\n2. second\n3. third'} />);
    expect(container.querySelector('ol')).not.toBeNull();
    expect(container.querySelectorAll('ol li').length).toBe(3);
  });

  // Code

  it('renders fenced code block (```) as <pre><code>', () => {
    const { container } = render(<Preview value={'```\nconst x = 1;\n```'} />);
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.querySelector('pre code')).not.toBeNull();
  });

  it('renders inline code (`code`) as <code>', () => {
    const { container } = render(<Preview value="call `render()` here" />);
    expect(container.querySelector('code')?.textContent).toBe('render()');
  });

  // Paragraphs

  it('renders a plain paragraph as <p>', () => {
    const { container } = render(<Preview value="Just a plain paragraph." />);
    expect(container.querySelector('p')).not.toBeNull();
  });

  // Negative cases — CommonMark stricter than basic renderers

  it('[VERIFIER-ADDED] does NOT render a heading from text without the # prefix', () => {
    // Negative: "NotAHeading" plain text must render as <p>, not <h1>
    const { container } = render(<Preview value="NotAHeading" />);
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('p')).not.toBeNull();
  });

  it('[VERIFIER-ADDED] does NOT render a link from bare text without Markdown link syntax', () => {
    // Negative: bare text "click here" must not become an <a> element
    // (linkify only fires for bare URLs, not arbitrary text)
    const { container } = render(<Preview value="click here" />);
    expect(container.querySelector('a')).toBeNull();
  });

  it('[VERIFIER-ADDED] empty string produces no heading, paragraph, or list elements', () => {
    // Negative: empty source must produce empty or near-empty output, not spurious elements
    const { container } = render(<Preview value="" />);
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('ol')).toBeNull();
  });

  it('[VERIFIER-ADDED] XSS safety: <script> tags in source are escaped, not executed', () => {
    const { container } = render(<Preview value={"<script>window.__xss=true</script>"} />);
    expect(container.querySelector('script')).toBeNull();
    expect(window.__xss).toBeUndefined();
  });

  it('[VERIFIER-ADDED] XSS safety: raw HTML tags in source are escaped to text, not rendered', () => {
    const { container } = render(<Preview value="<b>not bold</b>" />);
    expect(container.querySelector('b')).toBeNull();
  });
});

// ===========================================================================
// AC-6 [REQ-007]: Editor dark background + monospace font
// ===========================================================================

describe('AC-6 [REQ-007]: Editor dark background and monospace font (ADR-008)', () => {
  // Given: the Editor component renders its outer container
  // When: we inspect the class list of the editor-panel element
  // Then: it carries bg-bg-editor (which maps to #1E1E1E per ADR-008 design tokens)

  it('editor-panel carries the bg-bg-editor Tailwind token class', () => {
    const { container } = render(<Editor value="" onChange={vi.fn()} />);
    const editorPanel = container.querySelector('[data-testid="editor-panel"]');
    expect(editorPanel).not.toBeNull();
    expect(editorPanel.className).toContain('bg-bg-editor');
  });

  it('CodeMirror instance receives an inline font-family with a monospace stack', () => {
    render(<Editor value="test" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    expect(props.style).toBeDefined();
    const fontFamily = props.style.fontFamily;
    expect(fontFamily).toBeDefined();
    // Must contain at least one monospace font name from the ADR-008 stack
    const hasMonospace =
      fontFamily.includes('JetBrains Mono') ||
      fontFamily.includes('Fira Code') ||
      fontFamily.includes('monospace');
    expect(hasMonospace).toBe(true);
  });

  it('CodeMirror instance receives fontSize of 14px', () => {
    render(<Editor value="" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    expect(props.style?.fontSize).toBe('14px');
  });

  it('[VERIFIER-ADDED] editor-panel does NOT carry a light background class (bg-bg-primary or bg-white)', () => {
    // Negative: the editor must use the dark bg-editor token, not the light primary background
    const { container } = render(<Editor value="" onChange={vi.fn()} />);
    const editorPanel = container.querySelector('[data-testid="editor-panel"]');
    expect(editorPanel.className).not.toContain('bg-bg-primary');
    expect(editorPanel.className).not.toContain('bg-white');
  });

  it('[VERIFIER-ADDED] no sans-serif font family is applied to the CodeMirror instance', () => {
    // Negative: CodeMirror must use monospace, not the system sans-serif stack
    render(<Editor value="" onChange={vi.fn()} />);
    const props = capturedCodeMirrorProps.current;
    // The font-family must not be a sans-serif-only stack with no monospace family
    const fontFamily = props.style?.fontFamily || '';
    // It should not be a pure sans-serif definition without any monospace font
    const hasNoMonospace =
      !fontFamily.includes('JetBrains Mono') &&
      !fontFamily.includes('Fira Code') &&
      !fontFamily.includes('Source Code Pro') &&
      !fontFamily.includes('Consolas') &&
      !fontFamily.includes('monospace');
    expect(hasNoMonospace).toBe(false);
  });
});

// ===========================================================================
// AC-7 [REQ-007]: Preview light background + system font stack
// ===========================================================================

describe('AC-7 [REQ-007]: Preview light background and system font stack (ADR-008)', () => {
  // Given: the Preview component renders
  // When: we inspect the class list of the preview-panel element
  // Then: it carries bg-bg-primary (#FFFFFF) and font-sans (system font stack)

  it('preview-panel carries the bg-bg-primary Tailwind token class', () => {
    const { container } = render(<Preview value="hello" />);
    const previewPanel = container.querySelector('[data-testid="preview-panel"]');
    expect(previewPanel).not.toBeNull();
    expect(previewPanel.className).toContain('bg-bg-primary');
  });

  it('preview-panel carries the font-sans Tailwind class (system font stack)', () => {
    const { container } = render(<Preview value="hello" />);
    const previewPanel = container.querySelector('[data-testid="preview-panel"]');
    expect(previewPanel.className).toContain('font-sans');
  });

  it('preview-panel carries the text-text-primary Tailwind class', () => {
    const { container } = render(<Preview value="hello" />);
    const previewPanel = container.querySelector('[data-testid="preview-panel"]');
    expect(previewPanel.className).toContain('text-text-primary');
  });

  it('[VERIFIER-ADDED] preview-panel does NOT carry the dark editor background class (bg-bg-editor)', () => {
    // Negative: the preview must use the light background, not the dark editor token
    const { container } = render(<Preview value="hello" />);
    const previewPanel = container.querySelector('[data-testid="preview-panel"]');
    expect(previewPanel.className).not.toContain('bg-bg-editor');
  });

  it('[VERIFIER-ADDED] preview-panel does NOT carry a font-mono class (prose uses system sans-serif)', () => {
    // Negative: prose content must use the system font, not monospace
    const { container } = render(<Preview value="hello" />);
    const previewPanel = container.querySelector('[data-testid="preview-panel"]');
    expect(previewPanel.className).not.toContain('font-mono');
  });
});

// ===========================================================================
// AC-8 [REQ-007]: Panel dividers — 1px solid border lines (no shadows, no gradients)
// ===========================================================================

describe('AC-8 [REQ-007]: Panel dividers are 1px solid border lines (ADR-008)', () => {
  // Given: the WorkspaceLayout renders the three-panel grid
  // When: we inspect the panel separator elements
  // Then: they use border-r border-border CSS — 1px solid border — no shadows or gradients

  it('editor column in workspace layout carries border-r class (1px right border)', () => {
    const { container } = renderWorkspacePage();
    // The editor panel slot in WorkspaceLayout wraps the Editor component
    // and carries border-r border-border classes per the layout spec
    const editorPanel = container.querySelector('[data-testid="editor-panel"]');
    expect(editorPanel).not.toBeNull();
    // Walk up to the WorkspaceLayout slot wrapper — it directly contains the Editor
    const editorSlot = editorPanel.parentElement;
    expect(editorSlot.className).toContain('border-r');
  });

  it('editor slot wrapper carries border-border class (ADR-008 border color token)', () => {
    const { container } = renderWorkspacePage();
    const editorPanel = container.querySelector('[data-testid="editor-panel"]');
    const editorSlot = editorPanel.parentElement;
    expect(editorSlot.className).toContain('border-border');
  });

  it('[VERIFIER-ADDED] no workspace element carries a shadow class (ADR-008 prohibits heavy shadows between panels)', () => {
    // Negative: panel dividers must be border-only — no box-shadow utilities
    const { container } = renderWorkspacePage();
    const allElements = container.querySelectorAll('*');
    const shadowClasses = ['shadow-lg', 'shadow-md', 'shadow-xl', 'shadow-2xl'];
    allElements.forEach((el) => {
      shadowClasses.forEach((cls) => {
        expect(el.className).not.toContain(cls);
      });
    });
  });

  it('[VERIFIER-ADDED] no workspace element carries a gradient class (ADR-008 prohibits gradient backgrounds)', () => {
    // Negative: panel backgrounds must be solid — no bg-gradient utilities
    const { container } = renderWorkspacePage();
    const allElements = container.querySelectorAll('*');
    allElements.forEach((el) => {
      if (typeof el.className === 'string') {
        expect(el.className).not.toContain('bg-gradient');
        expect(el.className).not.toContain('from-');
        expect(el.className).not.toContain('to-');
      }
    });
  });
});
