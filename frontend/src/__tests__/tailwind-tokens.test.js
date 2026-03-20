/**
 * TASK-016 -- Acceptance Criterion 5 & 6
 * Verifies tailwind.config.js contains all ADR-008 design tokens.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config.js';

describe('tailwind.config.js design tokens (ADR-008)', () => {
  const colors = tailwindConfig.theme.extend.colors;

  const expectedColors = {
    'bg-primary': '#FFFFFF',
    'bg-secondary': '#F8F9FA',
    'bg-tertiary': '#E9ECEF',
    'bg-editor': '#1E1E1E',
    'text-primary': '#212529',
    'text-secondary': '#6C757D',
    'text-muted': '#ADB5BD',
    'accent': '#0D6EFD',
    'accent-hover': '#0B5ED7',
    'border': '#DEE2E6',
    'success': '#198754',
    'error': '#DC3545',
    'warning': '#FFC107',
  };

  it('contains all 13 color tokens from ADR-008', () => {
    const tokenNames = Object.keys(expectedColors);
    expect(Object.keys(colors)).toEqual(expect.arrayContaining(tokenNames));
  });

  Object.entries(expectedColors).forEach(([token, value]) => {
    it(`defines ${token} as ${value}`, () => {
      expect(colors[token]).toBe(value);
    });
  });

  it('defines sans font family with system font stack', () => {
    const sans = tailwindConfig.theme.extend.fontFamily.sans;
    expect(sans).toContain('-apple-system');
    expect(sans).toContain('BlinkMacSystemFont');
    expect(sans).toContain('Roboto');
  });

  it('defines mono font family with JetBrains Mono', () => {
    const mono = tailwindConfig.theme.extend.fontFamily.mono;
    expect(mono[0]).toContain('JetBrains Mono');
    expect(mono).toEqual(expect.arrayContaining([expect.stringContaining('Consolas')]));
  });

  describe('spacing tokens', () => {
    const spacing = tailwindConfig.theme.extend.spacing;

    const expectedSpacing = {
      'space-xs': '4px',
      'space-sm': '8px',
      'space-md': '16px',
      'space-lg': '24px',
      'space-xl': '32px',
    };

    it('contains all 5 spacing tokens from ADR-008', () => {
      expect(Object.keys(spacing)).toEqual(expect.arrayContaining(Object.keys(expectedSpacing)));
    });

    Object.entries(expectedSpacing).forEach(([token, value]) => {
      it(`defines ${token} as ${value}`, () => {
        expect(spacing[token]).toBe(value);
      });
    });
  });

  it('caps border radius at 4px (no values above 4px except full)', () => {
    const radii = tailwindConfig.theme.extend.borderRadius;
    Object.entries(radii).forEach(([key, value]) => {
      if (key === 'full') return; // full is allowed for functional uses
      const px = parseInt(value);
      expect(px).toBeLessThanOrEqual(4);
    });
  });
});
