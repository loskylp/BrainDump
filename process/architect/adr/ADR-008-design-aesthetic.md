# ADR-008: Professional/Technical Design Aesthetic (AUDIT-003)
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

AUDIT-003 identified that the professional/technical design aesthetic is a cross-cutting concern stated in the Brief's Ground Truths but not captured as a standalone requirement. It is referenced in REQ-007 (editor) and REQ-017 (landing page) but not explicitly in REQ-008 (catalog) or REQ-010 (search results). The Auditor deferred this to the Architecture Gate.

The Brief states: "The visual design is clean, functional, and technically oriented -- not playful, generic, or consumer-app styled. This applies to all UI surfaces: the catalog, the editor, and the search results."

The Designer agent is skipped per Manifest. The Builder implements UI from requirements. Without explicit design guidance, the Builder would make ad-hoc visual decisions that may or may not cohere into a professional aesthetic. This ADR provides the constraint system.

**Driver:** Maintainability (visual consistency across features built at different times), Testability (aesthetic can be verified against concrete criteria)
**Door type:** Two-way -- the design token system is a CSS configuration; changing the palette, typography, or spacing is a configuration update, not an architectural change

## Trade-off Analysis

### Aesthetic Enforcement Mechanism

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Tailwind CSS with locked design tokens | Utility-first approach constrains choices to the token system, rapid UI development, no custom CSS for common patterns, consistent spacing/color/typography | Learning curve for developers unfamiliar with Tailwind, utility classes in markup can be verbose | Token system may be too restrictive -- Builder requests exceptions | LOW -- update tailwind.config.js |
| Component library (e.g., Radix + custom theme) | Pre-built accessible components, enforced consistency through component API | Library lock-in, potential style conflicts, overhead for simple layouts | Components may not match the desired aesthetic without significant customization | MEDIUM -- swap component library |
| Custom CSS with design guidelines document | Full control, no dependencies | No enforcement -- guidelines are advisory; consistency depends on developer discipline | Inconsistent implementation across features built at different times | LOW to adopt a framework later, but HIGH cost of accumulated inconsistency |
| No explicit guidance (rely on Brief text) | Zero overhead | Inconsistent aesthetic, each feature looks different, "not playful" is subjective | Builder interprets "professional" differently for each screen | HIGH -- visual rework across all surfaces |

**Recommendation:** Tailwind CSS with locked design tokens
**Because:** The design token system in `tailwind.config.js` acts as the single source of truth for visual decisions. The Builder uses utility classes from this constrained palette rather than inventing colors, fonts, or spacing on each screen. The tokens encode the professional/technical aesthetic as configuration, not documentation. If the aesthetic needs adjustment, changing the config file updates every surface at once.

## Decision

### Design Token System

The following tokens define the BrainDump aesthetic. They are encoded in `tailwind.config.js` and are the authoritative source for all visual decisions.

**Color Palette (Neutral, Technical):**

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#FFFFFF` | Main content background |
| `bg-secondary` | `#F8F9FA` | Sidebar, secondary panels |
| `bg-tertiary` | `#E9ECEF` | Hover states, subtle separators |
| `bg-editor` | `#1E1E1E` | Editor panel (dark, code-editor feel) |
| `text-primary` | `#212529` | Primary text |
| `text-secondary` | `#6C757D` | Secondary text, metadata, timestamps |
| `text-muted` | `#ADB5BD` | Placeholder text, disabled states |
| `accent` | `#0D6EFD` | Links, primary actions, focus rings |
| `accent-hover` | `#0B5ED7` | Hover state for accent |
| `border` | `#DEE2E6` | Panel dividers, input borders |
| `success` | `#198754` | Save confirmation, success states |
| `error` | `#DC3545` | Error states, destructive action warnings |
| `warning` | `#FFC107` | Warning states |

**Typography:**

| Context | Font | Size | Weight |
|---|---|---|---|
| Body text / UI | System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | 14px base | 400 (regular), 600 (semibold for labels) |
| Code / Editor | `'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Consolas', monospace` | 14px | 400 |
| Headings | System font stack | 16-24px (scale by level) | 600 |
| Note titles in catalog | System font stack | 14px | 500 |
| Metadata (dates, versions) | System font stack | 12px | 400 |

**Spacing:**

| Token | Value | Usage |
|---|---|---|
| `space-xs` | `4px` | Inline spacing, icon margins |
| `space-sm` | `8px` | Compact padding (catalog items, input padding) |
| `space-md` | `16px` | Standard padding (panels, cards) |
| `space-lg` | `24px` | Section spacing |
| `space-xl` | `32px` | Page-level spacing |

**Layout Principles:**

1. **Panel dividers are 1px solid border lines** -- no shadows, no gradients between panels
2. **Minimum 8px padding on all interactive elements** -- touch target accessibility
3. **No rounded corners > 4px** -- technical tools use sharp geometry
4. **No decorative icons or illustrations** -- icons are functional only (e.g., search, folder, delete)
5. **Monospace font in all code-related contexts** -- editor, preview code blocks, version diffs
6. **Dark editor panel, light surrounding UI** -- the editor is a code editor; the chrome is a professional tool

### Aesthetic Anti-patterns (What BrainDump Is Not)

The Builder must NOT:
- Use gradient backgrounds or colorful accent panels
- Add emoji or playful iconography
- Use rounded pill-shaped buttons or bubbly UI elements
- Apply box shadows heavier than `0 1px 3px rgba(0,0,0,0.1)`
- Use more than 3 font sizes on a single screen
- Use colored backgrounds for content areas (white/near-white only)

### AUDIT-003 Resolution

This ADR resolves AUDIT-003 by:
1. Defining concrete, verifiable design tokens that apply to ALL UI surfaces (not just the two surfaces where REQ-007 and REQ-017 mention the aesthetic)
2. Providing the Tailwind configuration as an enforcement mechanism (the Builder cannot deviate without modifying the config, which is a reviewable change)
3. Listing explicit anti-patterns so "professional/technical" is not subjective

The catalog sidebar (REQ-008), search results (REQ-010), and all other screens are constrained by this token system, even though those requirements do not individually reference the aesthetic.

## Fitness Functions

**Dev:**
- Tailwind config is frozen -- any modification to the color palette, typography, or spacing tokens must be reviewed (CI can flag changes to `tailwind.config.js` as requiring review)
- Visual regression: Lighthouse CI accessibility audit passes (contrast ratios, touch targets)
- No inline styles in React components that override Tailwind token values (linting rule)

**Prod:**
- No production-side automated aesthetic verification (this is a client-side concern verified in development and at Demo Sign-off)
- Nexus reviews visual consistency at each Demo Sign-off -- this is the human verification of the aesthetic

## Consequences

- The Builder works within a constrained visual vocabulary -- this speeds up UI decisions but limits creative freedom
- The dark editor panel + light chrome creates a visual hierarchy that emphasizes the editing experience
- The monospace font stack requires loading web fonts (JetBrains Mono is open source) or falling back to system monospace -- font loading adds ~20KB to initial page load
- Tailwind's utility-first approach produces verbose HTML class lists -- this is a readability trade-off for consistency enforcement
- The anti-pattern list is prescriptive rather than descriptive -- it tells the Builder what to avoid rather than what to aspire to. The token system provides the aspiration; the anti-patterns prevent common deviations.
