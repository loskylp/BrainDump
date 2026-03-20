# Scaffold Manifest -- BrainDump Cycle 1
**Date:** 2026-03-19
**Scaffolder version:** 1
**Covers:** Cycle 1 Builder tasks TASK-002 through TASK-013, TASK-016
**Architecture source:** architecture-overview-v1.md, ADR-001 through ADR-009

---

## What Was Scaffolded

All files in `backend/src/` and `frontend/src/` listed below. Every file contains signatures, JSDoc contracts, and `// TODO: TASK-NNN` markers. No implementation logic exists in any scaffolded file.

## What Was Intentionally Left Out

- **Migration files** (`backend/src/migrations/`): TASK-002 creates all Sequelize migration files. The directory exists with a `.gitkeep`. The Scaffolder does not pre-create migration stubs because migration content depends on the exact DDL decisions made during implementation.
- **Folders route and API** (`backend/src/routes/folders.js`, `frontend/src/api/folders.js`): Folder management is TASK-017, a Cycle 2 task. The Folder model and associations are scaffolded because they are referenced in the schema, but the route and frontend API are not scaffolded for Cycle 1.
- **Version History UI components** (`VersionList`, `VersionViewer`): These are Cycle 1 TASK-013 scope. The Builder for TASK-013 creates these components fresh -- they have no ambiguous interface boundary shared across tasks, so pre-scaffolding would add no value.
- **Password reset forms** (`ForgotPasswordForm.jsx`, `ResetPasswordForm.jsx`): These are TASK-015, Cycle 2. Not scaffolded for Cycle 1.
- **Test files**: The Scaffolder does not produce test files. Tests are written by the Builder as part of each task.

---

## Component Dependency Order

The following order must be respected. A component marked with `>>` must be implemented before those after it:

```
TASK-016 (app wiring, routing shell, Tailwind config)
    >> All frontend pages render correctly

TASK-002 (database schema, migrations, RLS, models, rlsContext middleware)
    >> All routes that touch the database

TASK-003 (register route + RegisterForm)
    >> TASK-004 (login requires users to exist)

TASK-004 (login/logout routes + LoginForm + useAuth)
    >> TASK-005 (authenticate middleware + ownershipGuard)

TASK-005 (authenticate + ownershipGuard)
    >> TASK-006 (create note -- first authenticated data write)

TASK-006 (createNote + noteService + initial version)
    >> TASK-008 (sidebar needs notes to display)
    >> TASK-009 (edit requires notes to exist)
    >> TASK-010 (delete requires notes to exist)

TASK-007 (Editor + Preview components)
    >> TASK-009 (edit note wires editor to API)

TASK-009 (updateNote, load note content)
    >> TASK-012 (auto-save uses the PUT /api/notes/:id path)

TASK-012 (useAutoSave)
    >> TASK-013 (version timer fires after auto-save has established the current state)
```

---

## Exported Interfaces -- Backend

### `backend/src/config/database.js`
- **Default export:** `sequelize` -- Sequelize instance (null until TASK-002)
- **Used by:** `models/index.js`, `middleware/rlsContext.js`, `config/session.js`

### `backend/src/config/session.js`
- **Default export:** Express session middleware function
- **Used by:** `src/app.js`

### `backend/src/models/index.js`
- **Named exports:** `{ sequelize, User, Note, NoteVersion, Folder }`
- **Used by:** all route handlers and services

### `backend/src/models/User.js`
- **Default export:** `User` Sequelize Model class
- **Instance method:** `comparePassword(plaintext: string): Promise<boolean>`

### `backend/src/models/Note.js`
- **Default export:** `Note` Sequelize Model class
- **Default scope:** adds `WHERE user_id = currentUserId` to all queries (TASK-002)
- **Fields:** `id`, `user_id`, `folder_id`, `title`, `body`, `search_vector` (read-only), `created_at`, `updated_at`

### `backend/src/models/NoteVersion.js`
- **Default export:** `NoteVersion` Sequelize Model class
- **Fields:** `id`, `note_id`, `title`, `body`, `version_number`, `created_at` (no `updated_at`)
- **Default sort:** `version_number DESC`

### `backend/src/models/Folder.js`
- **Default export:** `Folder` Sequelize Model class
- **Fields:** `id`, `user_id`, `name`, `created_at`, `updated_at`

### `backend/src/middleware/authenticate.js`
- **Default export:** `authenticate(req, res, next)` -- Express middleware
- **Contract:** passes if `req.session.userId` exists; returns 401 otherwise

### `backend/src/middleware/ownershipGuard.js`
- **Default export:** `ownershipGuard(modelName, paramName)` -- factory returning Express middleware
- **Contract:** loads resource, verifies `resource.user_id === req.session.userId`; attaches `req.resource`; returns 404 on mismatch

### `backend/src/middleware/rlsContext.js`
- **Default export:** `rlsContext(req, res, next)` -- async Express middleware
- **Contract:** executes `SET LOCAL app.current_user_id` before passing to next

### `backend/src/services/authService.js`
- **Named exports:** `{ register, login, logout, forgotPassword, resetPassword }`

| Function | Parameters | Returns | Throws |
|---|---|---|---|
| `register` | `{ username, email, password }` | `Promise<User>` | `EMAIL_TAKEN`, `VALIDATION_ERROR` |
| `login` | `email, password` | `Promise<User>` | `INVALID_CREDENTIALS` |
| `logout` | `session` | `Promise<void>` | store error |
| `forgotPassword` | `email, appUrl` | `Promise<void>` | (never throws for email not found) |
| `resetPassword` | `token, newPassword` | `Promise<void>` | `INVALID_TOKEN`, `VALIDATION_ERROR` |

### `backend/src/services/noteService.js`
- **Named exports:** `{ createNote, getNotes, getNote, updateNote, deleteNote }`

| Function | Parameters | Returns | Throws |
|---|---|---|---|
| `createNote` | `userId, { title, folderId }` | `Promise<Note>` | `FOLDER_NOT_FOUND` |
| `getNotes` | `userId` | `Promise<Note[]>` | — |
| `getNote` | `noteId, userId` | `Promise<Note>` | `NOT_FOUND` |
| `updateNote` | `noteId, userId, updates` | `Promise<Note>` | `NOT_FOUND` |
| `deleteNote` | `noteId, userId` | `Promise<void>` | `NOT_FOUND` |

### `backend/src/services/versionService.js`
- **Named exports:** `{ checkAndCreateVersion, getVersions, restoreVersion }`

| Function | Parameters | Returns | Throws |
|---|---|---|---|
| `checkAndCreateVersion` | `noteId, userId` | `Promise<{ created: boolean, version: NoteVersion\|null }>` | `NOT_FOUND` |
| `getVersions` | `noteId, userId` | `Promise<NoteVersion[]>` | `NOT_FOUND` |
| `restoreVersion` | `noteId, versionId, userId` | `Promise<{ note: Note, newVersion: NoteVersion }>` | `NOT_FOUND`, `VERSION_MISMATCH` |

### `backend/src/services/searchService.js`
- **Named exports:** `{ search }`

| Function | Parameters | Returns | Throws |
|---|---|---|---|
| `search` | `userId, rawQuery` | `Promise<SearchResult[]>` | `EMPTY_QUERY` |

SearchResult: `{ id: string, title: string, snippet: string, rank: number }`

### `backend/src/services/emailService.js`
- **Named exports:** `{ sendPasswordReset }`

| Function | Parameters | Returns | Throws |
|---|---|---|---|
| `sendPasswordReset` | `to: string, resetUrl: string` | `Promise<void>` | `EMAIL_SEND_FAILED` |

---

## Exported Interfaces -- Frontend

### `frontend/src/api/client.js`
- **Named exports:** `{ apiRequest, get, post, put, del }`
- `apiRequest(path, options): Promise<any>` -- base fetch wrapper with session cookie

### `frontend/src/api/auth.js`
- **Named exports:** `{ register, login, logout, forgotPassword, resetPassword }`

### `frontend/src/api/notes.js`
- **Named exports:** `{ getNotes, createNote, getNote, updateNote, deleteNote }`

### `frontend/src/api/versions.js`
- **Named exports:** `{ checkVersion, getVersions, restoreVersion }`

### `frontend/src/api/search.js`
- **Named exports:** `{ search }`

### `frontend/src/hooks/useAuth.js`
- **Named export:** `useAuth()`
- **Returns:** `{ user, isAuthenticated, isLoading, login, logout }`

### `frontend/src/hooks/useAutoSave.js`
- **Named export:** `useAutoSave({ noteId, content, debounceMs? })`
- **Returns:** `{ status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }`

### `frontend/src/hooks/useVersionTimer.js`
- **Named export:** `useVersionTimer({ noteId, contentKey, idleMs?, onVersionCreated? })`
- **Returns:** void

### `frontend/src/components/layout/WorkspaceLayout.jsx`
- **Default export:** `WorkspaceLayout({ sidebar, editor, preview })`
- **Contract:** renders CSS Grid, 260px | 1fr | 1fr at >= 1024px

### `frontend/src/components/layout/Sidebar.jsx`
- **Default export:** `Sidebar({ notes, activeNoteId, onSelectNote, onCreateNote, isLoading })`

### `frontend/src/components/editor/Editor.jsx`
- **Default export:** `Editor({ value, onChange, readOnly? })`
- **Contract:** CodeMirror 6 controlled component with Markdown syntax highlighting

### `frontend/src/components/editor/Preview.jsx`
- **Default export:** `Preview({ value })`
- **Contract:** markdown-it rendered output, html: false (XSS safe)

### `frontend/src/components/auth/LoginForm.jsx`
- **Default export:** `LoginForm({ onSuccess, onForgotPassword })`

### `frontend/src/components/auth/RegisterForm.jsx`
- **Default export:** `RegisterForm({ onSuccess })`

### `frontend/src/components/common/ProtectedRoute.jsx`
- **Default export:** `ProtectedRoute({ children })`
- **Contract:** redirects to /login if not authenticated

### `frontend/src/components/common/SaveIndicator.jsx`
- **Default export:** `SaveIndicator({ status })`

### `frontend/src/components/common/ConfirmDialog.jsx`
- **Default export:** `ConfirmDialog({ isOpen, title, message, confirmLabel?, cancelLabel?, onConfirm, onCancel })`

### Pages
All page components are default exports with no required props:
- `LandingPage` (TASK-011)
- `WorkspacePage` (TASK-016 shell, completed across TASK-007 through TASK-013)
- `LoginPage` (TASK-004)
- `RegisterPage` (TASK-003)

---

## API Endpoint Surface

| Method | Path | Auth | Task | Handler |
|---|---|---|---|---|
| GET | /api/health | No | TASK-001 | routes/health.js |
| POST | /api/auth/register | No | TASK-003 | routes/auth.js |
| POST | /api/auth/login | No | TASK-004 | routes/auth.js |
| POST | /api/auth/logout | No | TASK-004 | routes/auth.js |
| POST | /api/auth/forgot-password | No | TASK-015 | routes/auth.js |
| POST | /api/auth/reset-password | No | TASK-015 | routes/auth.js |
| GET | /api/notes | Yes | TASK-009 | routes/notes.js |
| POST | /api/notes | Yes | TASK-006 | routes/notes.js |
| GET | /api/notes/:id | Yes | TASK-009 | routes/notes.js |
| PUT | /api/notes/:id | Yes | TASK-009 | routes/notes.js |
| DELETE | /api/notes/:id | Yes | TASK-010 | routes/notes.js |
| POST | /api/notes/:id/check-version | Yes | TASK-013 | routes/versions.js |
| GET | /api/notes/:id/versions | Yes | TASK-013 | routes/versions.js |
| POST | /api/notes/:id/versions/restore/:versionId | Yes | TASK-013 | routes/versions.js |
| GET | /api/search?q= | Yes | TASK-014 | routes/search.js |

---

## Complexity Signals

These are non-trivial implementation areas the Builder should expect to invest time in:

| Component | Complexity | Reason |
|---|---|---|
| `versionService.checkAndCreateVersion` | High | Requires SELECT FOR UPDATE transaction to prevent duplicate version_numbers from concurrent requests (ADR-004 consequence note) |
| `rlsContext middleware` | Medium | SET LOCAL must execute within the request's database connection/transaction; pooled connections require careful handling |
| `Note model defaultScope` | Medium | The default scope must inject the current user's ID per-request, not at module load time -- the implementation pattern for per-request scoping in Sequelize requires care |
| `useAutoSave + useVersionTimer interaction` | High | Two independent timers that share the same keystroke event but write to completely separate API paths (ADR-004). The Builder must ensure both timers reset on every content change without interfering with each other |
| `versionService.restoreVersion` | Medium | Requires a database transaction covering both the notes UPDATE and the NoteVersion INSERT |
| `authService.resetPassword session invalidation` | Medium | Must delete all session rows for the user from the sessions table -- requires a raw query or store-specific API, not a Sequelize model operation |
| `tailwind.config.js` | Low-Medium | All color tokens from ADR-008 must be defined precisely; this file is frozen post-TASK-016 and requires Nexus review to change |

---

## Ambiguities Discovered During Scaffolding

The following ambiguity surfaced and was resolved by reading ADR-004 carefully. It is documented here so the Builder is aware:

**Version route nesting:** The routing instruction listed `GET /api/notes/:id/versions` and `POST /api/notes/:id/versions/restore/:versionId` alongside `POST /api/notes/:id/check-version`. The check-version endpoint is mounted in `routes/versions.js` (not `routes/notes.js`) to keep all version-related logic in one file, using `express.Router({ mergeParams: true })` so `:id` is accessible from the parent router context. The Builder for TASK-013 must ensure app.js mounts the versions router at `/api/notes/:id` as a nested router.

**GET /api/auth/me:** The `useAuth` hook requires a session-check endpoint to verify authentication state on page load. This endpoint is not in the routing instruction but is implied by the auth flow. The Builder for TASK-004 should add `GET /api/auth/me` to `routes/auth.js` that returns `{ user: { id, username, email } }` if authenticated or 401 if not.

---

## File Inventory

### Backend (`backend/`)

```
backend/
  package.json                        -- All dependencies declared
  .sequelizerc                        -- Sequelize CLI path config
  src/
    app.js                            -- Express app factory (TODO: TASK-016)
    server.js                         -- HTTP server entry point (TODO: TASK-016)
    config/
      database.js                     -- Sequelize instance (TODO: TASK-002)
      session.js                      -- Session middleware (TODO: TASK-004)
    middleware/
      authenticate.js                 -- Session guard (TODO: TASK-005)
      ownershipGuard.js               -- Ownership check factory (TODO: TASK-005)
      rlsContext.js                   -- SET LOCAL app.current_user_id (TODO: TASK-002)
    models/
      index.js                        -- Model loader + associations (TODO: TASK-002)
      User.js                         -- User model (TODO: TASK-002)
      Note.js                         -- Note model + default scope (TODO: TASK-002)
      NoteVersion.js                  -- NoteVersion model (TODO: TASK-002)
      Folder.js                       -- Folder model (TODO: TASK-002)
    migrations/
      .gitkeep                        -- Placeholder; migration files created by TASK-002
    routes/
      health.js                       -- GET /api/health (TODO: TASK-001)
      auth.js                         -- Auth endpoints (TODO: TASK-003, TASK-004, TASK-015)
      notes.js                        -- Note CRUD (TODO: TASK-006, TASK-009, TASK-010)
      versions.js                     -- Version history + check (TODO: TASK-013)
      search.js                       -- FTS search (TODO: TASK-014)
    services/
      authService.js                  -- Auth business logic (TODO: TASK-003, TASK-004, TASK-015)
      noteService.js                  -- Note business logic (TODO: TASK-006, TASK-009, TASK-010)
      versionService.js               -- Version diff + creation (TODO: TASK-013)
      searchService.js                -- FTS query builder (TODO: TASK-014)
      emailService.js                 -- Email provider interface (TODO: TASK-015)
```

### Frontend (`frontend/`)

```
frontend/
  package.json                        -- All dependencies declared
  index.html                          -- Vite HTML entry
  vite.config.js                      -- Vite + API proxy (TODO: TASK-016)
  tailwind.config.js                  -- Locked design tokens (TODO: TASK-016, then FROZEN)
  postcss.config.js                   -- Tailwind + autoprefixer
  src/
    main.jsx                          -- React entry point (TODO: TASK-016)
    App.jsx                           -- Route definitions (TODO: TASK-016)
    styles/
      index.css                       -- Tailwind directives
    api/
      client.js                       -- fetch wrapper (TODO: TASK-016)
      auth.js                         -- Auth API calls (TODO: TASK-003, TASK-004, TASK-015)
      notes.js                        -- Note CRUD API calls (TODO: TASK-006, TASK-009, TASK-010)
      versions.js                     -- Version API calls (TODO: TASK-013)
      search.js                       -- Search API call (TODO: TASK-014)
    hooks/
      useAuth.js                      -- Auth state hook (TODO: TASK-004)
      useAutoSave.js                  -- 2s debounce auto-save (TODO: TASK-012)
      useVersionTimer.js              -- 30s idle version check (TODO: TASK-013)
    components/
      layout/
        WorkspaceLayout.jsx           -- CSS Grid three-panel (TODO: TASK-016)
        Sidebar.jsx                   -- Note catalog panel (TODO: TASK-008)
      editor/
        Editor.jsx                    -- CodeMirror 6 wrapper (TODO: TASK-007)
        Preview.jsx                   -- markdown-it renderer (TODO: TASK-007)
      auth/
        LoginForm.jsx                 -- Login form (TODO: TASK-004)
        RegisterForm.jsx              -- Registration form (TODO: TASK-003)
      common/
        ProtectedRoute.jsx            -- Auth route guard (TODO: TASK-016)
        SaveIndicator.jsx             -- Auto-save status (TODO: TASK-012)
        ConfirmDialog.jsx             -- Destructive action confirmation (TODO: TASK-010)
    pages/
      LandingPage.jsx                 -- Public entry page (TODO: TASK-011)
      WorkspacePage.jsx               -- Authenticated workspace shell (TODO: TASK-016)
      LoginPage.jsx                   -- Login page wrapper (TODO: TASK-004)
      RegisterPage.jsx                -- Registration page wrapper (TODO: TASK-003)
```

---

## Handoff Notes for the Builder

**Implementation start order:** Begin with TASK-016 (app wiring) to get the server running with a health check, then TASK-002 (schema). Every subsequent task has a runnable application to test against from TASK-016 onward.

**Critical implementation notes:**

1. **rlsContext and pooled connections:** Sequelize uses a connection pool. `SET LOCAL` only applies to the current transaction. The Builder must execute the SET LOCAL statement within the same transaction context as the queries that follow -- or use `sequelize.transaction()` to group them. If the pool returns a different connection for the SET LOCAL vs. the subsequent query, the RLS variable will not be visible. The Builder should read PostgreSQL documentation on `SET LOCAL` and connection pool transaction handling before implementing TASK-002.

2. **Note model defaultScope:** Sequelize's `defaultScope` is a static configuration and cannot reference per-request state like `req.session.userId`. The canonical pattern is to use `Note.scope({ method: ['forUser', userId] })` at the call site in each service function, rather than relying on a static default scope. The Builder should implement this as a named scope and apply it consistently in noteService, not as a default scope. The scaffold's model docstrings mention "default scope" per the ADR, but the implementation mechanism is a per-call scope application.

3. **Version router nesting:** `routes/versions.js` uses `express.Router({ mergeParams: true })`. In `app.js`, mount it as: `app.use('/api/notes/:id', versionsRouter)`. The `:id` parameter from the parent path is then available inside the versions router as `req.params.id`.

4. **tailwind.config.js is frozen after TASK-016:** The Builder implementing TASK-016 defines all design tokens. After that task is verified, no subsequent Builder task should modify this file. The Verifier will flag any changes.

5. **useAuth GET /api/auth/me:** The Builder for TASK-004 must add this endpoint. It is not in the routing instruction but is required by the `useAuth` hook's session-check-on-mount behavior. The endpoint: `GET /api/auth/me` -> 200 `{ user: { id, username, email } }` if `req.session.userId` is set, else 401.
