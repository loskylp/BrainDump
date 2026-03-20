# Routing Instruction
**To:** Scaffolder
**Phase:** EXECUTION (pre-Builder setup for Cycle 1)
**Task:** Set up the project skeleton for Cycle 1 -- directory structure, file signatures, interfaces, and contracts. No implementation logic.
**Load these artifacts:**
- `process/architect/architecture-overview-v1.md` (component map, schema, resource topology)
- `process/architect/adr/ADR-001-technology-stack.md` (Node.js, Express, React, Vite, CodeMirror 6, markdown-it, Sequelize, Tailwind)
- `process/architect/adr/ADR-002-authentication-sessions.md` (session management, bcrypt, password reset token flow)
- `process/architect/adr/ADR-003-data-persistence.md` (five-table schema, FK cascades, WAL mode)
- `process/architect/adr/ADR-004-autosave-versioning.md` (dual-timer architecture, auto-save vs. version creation)
- `process/architect/adr/ADR-005-fulltext-search.md` (tsvector, GIN index, weighted vectors, ts_headline)
- `process/architect/adr/ADR-006-data-isolation.md` (ownership guard middleware, Sequelize default scopes, RLS policies)
- `process/architect/adr/ADR-008-design-aesthetic.md` (Tailwind config, design tokens, color palette, typography)
- `process/architect/adr/ADR-009-responsive-design.md` (progressive collapse, CSS Grid, breakpoints)
- `process/planner/task-plan-v1.md` (Cycle 1 tasks: TASK-002 through TASK-013, TASK-016)
- `process/devops/environment-contract-v1.md` (environment variables, builder programming contract)
**Produce:**
- Scaffolded project structure under `backend/` and `frontend/` with file stubs, interfaces, and contracts
- No implementation logic -- only signatures, empty functions, TODO markers, and structural wiring
**Return to:** Orchestrator when complete

---

## What Already Exists (DevOps Phase 1 output -- do NOT overwrite)

The following files were produced by DevOps Phase 1 and are already in the repository. The Scaffolder must work around them, not replace them:

- `Dockerfile` -- multi-stage production build (frontend-builder + production runtime)
- `Dockerfile.dev` -- development image with hot-reload
- `docker-compose.dev.yml` -- local development environment (PostgreSQL + backend + frontend)
- `docker-entrypoint.sh` -- migration-then-start entrypoint
- `.env.example` -- environment variable template
- `.github/workflows/ci.yml` -- CI pipeline (lint, test, integration test, migration test, build, push)

**The Dockerfile expects this project layout:**
- `backend/` -- Express server source, with `backend/src/server.js` as entry point
- `backend/package.json` and `backend/package-lock.json` -- backend dependencies
- `frontend/` -- React/Vite frontend source
- `frontend/package.json` and `frontend/package-lock.json` -- frontend dependencies
- `frontend/dist/` -- build output (produced by `npm run build` in frontend, copied to `public/` in the Docker image)

The Scaffolder MUST use this exact layout. The `backend/` and `frontend/` directories are the two workspaces.

---

## Scaffolding Scope

The Scaffolder sets up the structural skeleton so that each Builder task can focus on implementation rather than boilerplate wiring. The output must be:

1. **Directory structure** -- all directories from the Architect's component map
2. **File stubs** -- every file referenced in the component map, with exports and function signatures but no implementation
3. **Interfaces and contracts** -- module boundaries, function signatures, type expectations
4. **Dependency wiring** -- package.json files with all required dependencies, configuration files (ESLint, Tailwind, Vite, Sequelize)
5. **No implementation logic** -- functions contain only `// TODO: TASK-NNN` markers referencing the task that will implement them

---

## Backend Skeleton (`backend/`)

Based on the Architecture Overview component map:

```
backend/
  src/
    server.js              # Express app setup, middleware chain, route mounting, static file serving
    routes/
      auth.js              # POST /api/auth/register, POST /api/auth/login, POST /api/auth/logout,
                           # POST /api/auth/forgot-password, POST /api/auth/reset-password
      notes.js             # POST /api/notes, GET /api/notes, GET /api/notes/:id,
                           # PUT /api/notes/:id, DELETE /api/notes/:id, GET /api/notes/search
      versions.js          # GET /api/notes/:id/versions, GET /api/notes/:id/versions/:vid,
                           # POST /api/notes/:id/check-version, POST /api/notes/:id/versions/:vid/restore
      folders.js           # POST /api/folders, GET /api/folders, PUT /api/folders/:id,
                           # DELETE /api/folders/:id
      health.js            # GET /api/health (already partially defined by DevOps)
    middleware/
      authenticate.js      # Session validation middleware -- rejects unauthenticated requests
      ownershipGuard.js    # Per-user data isolation middleware -- injects user_id, verifies ownership
      setCurrentUser.js    # SET LOCAL app.current_user_id for RLS (executes per-request)
    models/
      index.js             # Sequelize instance + model loader
      User.js              # User model definition
      Note.js              # Note model with default scope (user_id filter), search_vector
      NoteVersion.js       # NoteVersion model with default scope
      Folder.js            # Folder model with default scope
      Session.js           # connect-pg-simple session model (if needed)
    migrations/            # Sequelize migration files (TASK-002 creates these)
    services/
      searchService.js     # FTS query builder: input sanitization, tsquery construction, ts_headline
      versionService.js    # Diff check + conditional version creation
      emailService.js      # Email interface: sendPasswordResetEmail(to, resetUrl) -- provider-branching
    config/
      database.js          # Sequelize configuration (reads POSTGRES_URL from env)
      session.js           # express-session configuration (reads SESSION_SECRET from env)
  .sequelizerc             # Sequelize CLI path configuration
  package.json             # Express, Sequelize, bcryptjs, connect-pg-simple, express-session, etc.
```

### Backend Dependencies (package.json)

Required production dependencies based on ADR-001 and ADR-002:
- `express` -- web framework
- `sequelize` -- ORM
- `pg` and `pg-hstore` -- PostgreSQL driver for Sequelize
- `sequelize-cli` -- migration CLI (can be devDependency)
- `bcryptjs` -- password hashing (ADR-002: cost factor 12)
- `express-session` -- session management
- `connect-pg-simple` -- PostgreSQL session store
- `cors` -- CORS middleware (for Vite dev proxy)
- `helmet` -- security headers

Required dev dependencies:
- `jest` -- test framework
- `supertest` -- HTTP assertion library for integration tests
- `nodemon` -- hot-reload (dev only)
- `eslint` -- linting

### Key Backend Contracts

**Health endpoint** (`routes/health.js`):
```js
// GET /api/health
// Returns { status: "ok", db: "connected" } with 200
// or { status: "error", db: "disconnected" } with 503
```

**Authentication middleware** (`middleware/authenticate.js`):
```js
// If req.session.userId exists, call next()
// Otherwise, return 401 { error: "Authentication required" }
```

**Ownership guard** (`middleware/ownershipGuard.js`):
```js
// For resource routes: load resource, verify resource.user_id === req.session.userId
// If mismatch: return 404 (not 403 -- prevents enumeration)
// For list/search routes: ensure WHERE user_id = req.session.userId
```

**RLS middleware** (`middleware/setCurrentUser.js`):
```js
// At start of each request (after authenticate):
// Execute SET LOCAL app.current_user_id = :userId on the database connection
// This enables RLS policies to enforce per-user isolation at the DB level
```

**Email service interface** (`services/emailService.js`):
```js
// async sendPasswordResetEmail(to, resetUrl)
// If EMAIL_PROVIDER === 'console': log to stdout
// Otherwise: delegate to configured provider using EMAIL_API_KEY
```

**Version service interface** (`services/versionService.js`):
```js
// async checkAndCreateVersion(noteId)
// Load latest version from note_versions for noteId
// Compare body with current notes.body
// If different: insert new note_versions row with incremented version_number
// If same: do nothing
// Returns: { created: boolean, version: NoteVersion | null }
```

**Search service interface** (`services/searchService.js`):
```js
// async search(userId, query)
// Sanitize query: split on whitespace, remove special chars, join with ' & ', append ':*' to last term
// Execute FTS query against search_vector with GIN index
// Weight: title = A, body = B
// Return: ranked results with ts_headline snippets
```

---

## Frontend Skeleton (`frontend/`)

Based on the Architecture Overview component map and ADR-008/ADR-009:

```
frontend/
  index.html               # Vite entry point
  vite.config.js            # Vite configuration with API proxy to backend
  tailwind.config.js        # ADR-008 locked design token system
  postcss.config.js         # Tailwind PostCSS plugin
  src/
    main.jsx                # React entry point, router setup
    App.jsx                 # Root component with route definitions
    api/
      client.js             # HTTP client wrapper (fetch with credentials: 'include')
      auth.js               # API functions: register, login, logout, forgotPassword, resetPassword
      notes.js              # API functions: createNote, getNotes, getNote, updateNote, deleteNote, searchNotes
      versions.js           # API functions: getVersions, getVersion, checkVersion, restoreVersion
      folders.js            # API functions: createFolder, getFolders, updateFolder, deleteFolder
    components/
      Auth/
        LoginForm.jsx       # Login form component
        RegisterForm.jsx    # Registration form component
        ForgotPasswordForm.jsx  # Password reset request form
        ResetPasswordForm.jsx   # Password reset submission form
      Landing/
        LandingPage.jsx     # Public landing page (REQ-017)
      Workspace/
        WorkspaceLayout.jsx # Three-panel CSS Grid layout (260px sidebar + 1fr editor + 1fr preview)
      Sidebar/
        NoteCatalog.jsx     # Note catalog sidebar (REQ-008)
        FolderTree.jsx      # Folder navigation within sidebar (REQ-009 -- Cycle 2)
      Editor/
        MarkdownEditor.jsx  # CodeMirror 6 editor wrapper (REQ-007 left panel)
      Preview/
        MarkdownPreview.jsx # markdown-it live renderer (REQ-007 right panel)
      VersionHistory/
        VersionList.jsx     # Version history list (REQ-016)
        VersionViewer.jsx   # Read-only version content viewer (REQ-016)
      Common/
        SaveIndicator.jsx   # Auto-save status display: "Saving..." / "Saved" / "Error"
        ConfirmDialog.jsx   # Reusable confirmation dialog (delete note, delete account)
        ProtectedRoute.jsx  # Route guard -- redirects to login if unauthenticated
    hooks/
      useAutoSave.js        # 2-second debounce auto-save hook (REQ-015, ADR-004)
      useVersionTimer.js    # 30-second idle version trigger hook (REQ-016, ADR-004)
      useAuth.js            # Authentication state management
    styles/
      index.css             # Tailwind directives (@tailwind base/components/utilities)
  package.json              # React, Vite, CodeMirror 6, markdown-it, Tailwind CSS, etc.
```

### Frontend Dependencies (package.json)

Required production dependencies based on ADR-001:
- `react` and `react-dom` -- UI framework
- `react-router-dom` -- client-side routing
- `@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`, `@codemirror/theme-one-dark` -- CodeMirror 6 editor
- `codemirror` -- CodeMirror 6 base
- `markdown-it` -- CommonMark-compliant Markdown renderer

Required dev dependencies:
- `vite` and `@vitejs/plugin-react` -- build tool
- `tailwindcss`, `postcss`, `autoprefixer` -- CSS framework
- `eslint` -- linting
- `vitest` (or `jest`) -- test framework
- `@testing-library/react` -- component testing

### Key Frontend Contracts

**Tailwind configuration** (`tailwind.config.js`):
Must contain the locked design token system from ADR-008:
```js
// Colors: bg-primary (#FFFFFF), bg-secondary (#F8F9FA), bg-editor (#1E1E1E),
//         text-primary (#1A1A2E), text-secondary (#6B7280), accent (#3B82F6),
//         accent-hover (#2563EB), border (#E5E7EB), success (#10B981),
//         warning (#F59E0B), error (#EF4444), surface (#FFFFFF), surface-alt (#F3F4F6)
// Typography: fontFamily.sans (system font stack), fontFamily.mono (monospace stack)
// Spacing: 4px base grid
// This file is frozen -- CI flags changes for review (FF-D35)
```

**Vite configuration** (`vite.config.js`):
```js
// Proxy /api/* requests to http://localhost:3000 in development
// This allows the frontend dev server (port 5173) to reach the backend (port 3000)
```

**API client** (`api/client.js`):
```js
// Wraps fetch() with:
// - credentials: 'include' (send session cookie)
// - Content-Type: application/json
// - Base URL handling (empty in dev, proxied by Vite)
// - Error response handling (throws on non-2xx)
```

**useAutoSave hook** (`hooks/useAutoSave.js`):
```js
// Accepts: noteId, content (title + body), onSaveStatusChange callback
// Behavior: 2-second debounce timer, resets on every content change
// On timer fire: calls PUT /api/notes/:id with current content
// Reports status: 'idle' | 'saving' | 'saved' | 'error'
// Does NOT create versions (that is useVersionTimer's job)
```

**useVersionTimer hook** (`hooks/useVersionTimer.js`):
```js
// Accepts: noteId, onVersionCreated callback
// Behavior: 30-second idle timer, resets on every keystroke
// On timer fire: calls POST /api/notes/:id/check-version
// Server performs diff and conditionally creates version
// Does NOT save content (that is useAutoSave's job)
```

**WorkspaceLayout** (`components/Workspace/WorkspaceLayout.jsx`):
```jsx
// CSS Grid: grid-template-columns: 260px 1fr 1fr
// Three children: <NoteCatalog />, <MarkdownEditor />, <MarkdownPreview />
// At >= 1024px: all three panels visible
// Responsive collapse handled by TASK-018 (Cycle 2)
```

---

## What the Scaffolder Must NOT Do

1. **Do NOT implement any business logic.** Every function body should be a stub with a `// TODO: TASK-NNN` comment referencing the task that will fill it in.
2. **Do NOT write tests.** Tests are written by the Builder as part of each task.
3. **Do NOT create migration files.** TASK-002 creates the schema migrations -- the Scaffolder only creates the `migrations/` directory.
4. **Do NOT modify DevOps Phase 1 files** (Dockerfile, docker-compose.dev.yml, docker-entrypoint.sh, .env.example, CI workflow). Work alongside them.
5. **Do NOT populate seed data.** The Scaffolder creates structure, not data.
6. **Do NOT install dependencies** (no `npm install`). Create the package.json files with the dependency lists; the Builder or dev environment handles installation.

---

## Task-to-File Mapping (for TODO markers)

The Scaffolder should place `// TODO: TASK-NNN` markers in the appropriate stubs:

| File(s) | TODO Task |
|---|---|
| `backend/src/migrations/*`, `backend/src/models/*`, `middleware/setCurrentUser.js` | TASK-002 |
| `backend/src/routes/auth.js` (register), `frontend/src/components/Auth/RegisterForm.jsx` | TASK-003 |
| `backend/src/routes/auth.js` (login, logout), `frontend/src/components/Auth/LoginForm.jsx` | TASK-004 |
| `backend/src/middleware/ownershipGuard.js`, `backend/src/middleware/authenticate.js` | TASK-005 |
| `backend/src/routes/notes.js` (create), model associations | TASK-006 |
| `frontend/src/components/Editor/*`, `frontend/src/components/Preview/*` | TASK-007 |
| `frontend/src/components/Sidebar/NoteCatalog.jsx` | TASK-008 |
| `backend/src/routes/notes.js` (update), editor-API integration | TASK-009 |
| `backend/src/routes/notes.js` (delete), `frontend/src/components/Common/ConfirmDialog.jsx` | TASK-010 |
| `frontend/src/components/Landing/LandingPage.jsx` | TASK-011 |
| `frontend/src/hooks/useAutoSave.js`, `frontend/src/components/Common/SaveIndicator.jsx` | TASK-012 |
| `backend/src/services/versionService.js`, `backend/src/routes/versions.js`, `frontend/src/hooks/useVersionTimer.js`, `frontend/src/components/VersionHistory/*` | TASK-013 |
| `frontend/src/App.jsx`, `frontend/src/components/Workspace/WorkspaceLayout.jsx`, `tailwind.config.js` | TASK-016 |

---

## After Scaffolding

When the Scaffolder returns, the Orchestrator will:
1. Verify the structure is in place
2. Begin routing Builder tasks in the Cycle 1 execution order: TASK-016, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006, TASK-008, TASK-011, TASK-007, TASK-009, TASK-010, TASK-012, TASK-013
3. Each Builder task is followed by a Verifier invocation
