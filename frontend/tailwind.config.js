/**
 * Tailwind CSS configuration -- BrainDump locked design token system.
 *
 * THIS FILE IS FROZEN. Any modification to the color palette, typography, or
 * spacing tokens must go through Nexus review. CI flags changes to this file
 * as requiring review (FF-D35). See ADR-008 for the full aesthetic rationale.
 *
 * The design token system encodes the professional/technical aesthetic:
 *   - Neutral color palette (whites, grays, single blue accent)
 *   - System font stack for prose, JetBrains Mono for code/editor contexts
 *   - 4px base spacing grid
 *   - Maximum 4px border radius (no pill-shaped elements)
 *   - No decorative elements, gradients, or shadows beyond 1px separators
 *
 * Color tokens map to semantic usage:
 *   bg-primary     #FFFFFF  -- Main content background
 *   bg-secondary   #F8F9FA  -- Sidebar, secondary panels
 *   bg-tertiary    #E9ECEF  -- Hover states, subtle separators
 *   bg-editor      #1E1E1E  -- CodeMirror editor panel (dark, code-editor feel)
 *   text-primary   #212529  -- Primary text
 *   text-secondary #6C757D  -- Metadata, timestamps, secondary labels
 *   text-muted     #ADB5BD  -- Placeholder text, disabled states
 *   accent         #0D6EFD  -- Links, primary actions, focus rings
 *   accent-hover   #0B5ED7  -- Hover state for accent elements
 *   border         #DEE2E6  -- Panel dividers, input borders (1px solid)
 *   success        #198754  -- Save confirmation, success states
 *   error          #DC3545  -- Error states, destructive action warnings
 *   warning        #FFC107  -- Warning states
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          "'Segoe UI'",
          'Roboto',
          'sans-serif',
        ],
        mono: [
          "'JetBrains Mono'",
          "'Fira Code'",
          "'Source Code Pro'",
          'Consolas',
          'monospace',
        ],
      },
      spacing: {
        'space-xs': '4px',
        'space-sm': '8px',
        'space-md': '16px',
        'space-lg': '24px',
        'space-xl': '32px',
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '4px',
        // Keep full for functional uses (avatars, badges) per Tailwind convention
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
