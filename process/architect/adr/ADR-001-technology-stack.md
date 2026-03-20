# ADR-001: Technology Stack Selection
**Date:** 2026-03-19 | **Status:** Accepted | **Profile:** Commercial/Draft

## Context

BrainDump is a greenfield monolithic web application requiring: a three-panel interactive workspace (catalog + editor + live preview), real-time Markdown rendering on every keystroke, auto-save with debounce, PostgreSQL as the database, and server-side session management. The technology stack must support all of these within a single deployable unit while remaining maintainable by a solo developer.

**Driver:** Maintainability, Testability, Deployment model (monolith constraint)
**Door type:** One-way -- migrating an entire stack after significant development is a rewrite

## Trade-off Analysis

### Backend Language and Framework

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Node.js + Express | Unified JS stack (client+server), massive ecosystem, mature PostgreSQL libraries, async I/O suits a web app with many small requests | Single-threaded (CPU-bound work needs care), callback complexity (mitigated by async/await) | Performance ceiling for compute-heavy tasks (not expected for BrainDump) | CRITICAL -- full backend rewrite |
| Python + Django | Batteries-included (auth, ORM, admin), strong PostgreSQL support, rapid development | Two-language stack (Python backend + JS frontend), Django's ORM is opinionated, template system less useful for SPA | Over-engineering for a SPA-driven frontend; Django's server-rendered paradigm fights the three-panel layout | CRITICAL -- full backend rewrite |
| Go + Chi/Gin | High performance, compiled binary, simple deployment | Two-language stack, smaller ORM ecosystem, less rapid prototyping, no built-in auth/session | Over-engineering for a CRUD app with <50 concurrent users; slower feature velocity | CRITICAL -- full backend rewrite |

**Recommendation:** Node.js + Express
**Because:** The three-panel workspace is fundamentally a JavaScript application. A unified JS stack means the solo developer works in one language across the entire codebase. Express is minimal enough to avoid fighting framework opinions while mature enough for production use. BrainDump's workload (CRUD, text storage, search) is I/O-bound, which is Node.js's strength.

### ORM / Database Access

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| Sequelize | Migration system, model validation, PostgreSQL-specific features (JSONB, FTS helpers), widely used | Abstraction overhead, generated SQL can be suboptimal, learning curve for advanced queries | Complex FTS queries may need raw SQL fallback | MEDIUM -- swap ORM, keep migrations concept |
| Knex.js (query builder) | Closer to SQL, flexible, good migration support | No model layer (more boilerplate), manual validation | More code to maintain for standard CRUD | MEDIUM -- swap query builder |
| Raw pg (node-postgres) | Full SQL control, no abstraction overhead | No migrations, no model layer, repetitive boilerplate, manual SQL injection prevention | Maintenance burden grows with schema complexity | HIGH -- must build migration/model tooling or adopt ORM |

**Recommendation:** Sequelize
**Because:** Provides migration-based schema evolution (required by the deployment model), model-level validation, and handles the standard CRUD operations that make up 80% of BrainDump's data access. FTS queries will use raw SQL via `sequelize.query()` where the ORM abstraction does not fit -- this is an accepted escape hatch, not a limitation.

### Frontend Framework

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| React | Component model suits three-panel layout, hooks for timer logic (auto-save, versioning), vast ecosystem, CodeMirror 6 has first-class React bindings | Bundle size, JSX build step, state management complexity for larger apps | Over-engineering risk is low for this scope | CRITICAL -- full frontend rewrite |
| Vue.js | Simpler learning curve, good component model, lighter than React | Smaller ecosystem for editor integrations, CodeMirror 6 Vue bindings are community-maintained | Editor integration may require more custom work | CRITICAL -- full frontend rewrite |
| Vanilla JS + Web Components | No framework overhead, full control | Significant boilerplate for reactive UI, manual state management, harder to maintain three-panel interactions | Maintenance burden becomes unsustainable as features grow | CRITICAL -- adopt a framework later = rewrite |

**Recommendation:** React
**Because:** The three-panel workspace with real-time preview, auto-save timers, and version history UI is a stateful interactive application. React's component model and hooks API map directly to these concerns. CodeMirror 6 provides official React bindings (`@uiw/react-codemirror`), eliminating integration friction for the editor panel.

### Markdown Rendering

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| markdown-it | CommonMark-compliant, fast, extensible plugin system, widely used | Not a full AST parser (less suitable for complex transformations) | Limited extensibility if advanced features needed later | LOW -- swap renderer library |
| remark (unified) | Full AST, highly extensible, ecosystem of plugins | Heavier, more complex API for simple rendering, slower for keystroke-level re-rendering | Over-engineered for BrainDump's rendering needs | LOW -- swap renderer library |
| marked | Fast, simple API | Less strict CommonMark compliance, fewer plugins | May produce non-compliant output for edge cases | LOW -- swap renderer library |

**Recommendation:** markdown-it
**Because:** CommonMark compliance is a contractual requirement (Brief Ground Truth). markdown-it passes the CommonMark spec test suite and is fast enough for keystroke-level re-rendering in the preview panel. Its plugin system allows future extension (e.g., syntax highlighting in code blocks via markdown-it-highlightjs) without changing the rendering pipeline.

### Editor Component

| Option | Gains | Costs | Risk if wrong | Cost to change later |
|---|---|---|---|---|
| CodeMirror 6 | Production-grade, Markdown mode with syntax highlighting, accessibility, mobile support, React bindings, extensible | Learning curve for extension API, larger bundle than minimal editors | None significant -- it is the industry standard for web code editors | MEDIUM -- replace editor component, rewire events |
| Monaco Editor | VS Code's editor, powerful | Very heavy bundle (~5MB), designed for code editing not prose, overkill for Markdown | Bundle size hurts page load for a note-taking app | MEDIUM -- replace editor component |
| Textarea + custom highlighting | Minimal bundle, full control | No syntax highlighting without significant custom work, poor editing UX, accessibility concerns | Unusable editor experience for technical users | HIGH -- build or adopt a real editor later |

**Recommendation:** CodeMirror 6
**Because:** Provides Markdown syntax highlighting out of the box, handles the source editing panel requirements from REQ-007, has official React integration, and is designed for exactly this use case. Its extension system supports future additions (e.g., vim keybindings, custom autocomplete) without architectural changes.

## Decision

The BrainDump technology stack is:

| Layer | Technology | Version policy |
|---|---|---|
| Runtime | Node.js | LTS (current: 20.x) |
| Backend framework | Express | 4.x |
| ORM | Sequelize | 6.x |
| Database driver | pg (node-postgres) | Latest stable |
| Session store | connect-pg-simple | Latest stable |
| Frontend framework | React | 18.x |
| Build tool | Vite | Latest stable |
| Editor | CodeMirror 6 (@uiw/react-codemirror) | Latest stable |
| Markdown renderer | markdown-it | Latest stable |
| CSS framework | Tailwind CSS | 3.x (see ADR-008) |
| Testing | Jest (backend) + React Testing Library (frontend) | Latest stable |

## Fitness Functions

**Dev:** Project builds and all tests pass in CI. Lighthouse CI audit runs on every PR -- LCP < 2.5s, bundle size < 500KB gzipped (excluding CodeMirror).
**Prod:** Application starts and responds to health check within 5 seconds of container start. Monitor JS error rate in browser console (via error boundary logging) -- warn > 1% of sessions, critical > 5%.

## Consequences

- The solo developer works in one language (JavaScript/TypeScript) across the entire stack
- CodeMirror 6 and markdown-it are two-way door decisions (library swaps) if they prove insufficient
- Sequelize's migration system becomes the schema evolution mechanism -- all schema changes go through versioned migration files
- React's bundle adds ~40KB gzipped baseline; acceptable for a desktop-oriented web application
- Raw SQL escape hatch via `sequelize.query()` is expected for FTS queries (ADR-005) -- this is by design, not a workaround
