# Routing Instruction
**To:** Scaffolder
**Phase:** EXECUTION (pre-Builder setup for Cycle 2)
**Task:** Scaffold the structural additions for Cycle 2 -- new files, new routes, new components, new dependencies. Do NOT overwrite anything that already works from Cycle 1. Extend the existing codebase.
**Load these artifacts:**
- `process/architect/architecture-overview-v1.md` (component map, schema, resource topology)
- `process/architect/adr/ADR-002-authentication-sessions.md` (rate limiting context, password reset token flow)
- `process/architect/adr/ADR-003-data-persistence.md` (folder schema, CASCADE deletes)
- `process/architect/adr/ADR-005-fulltext-search.md` (tsvector, GIN index, weighted vectors, ts_headline)
- `process/architect/adr/ADR-008-design-aesthetic.md` (Tailwind config, design tokens)
- `process/architect/adr/ADR-009-responsive-design.md` (progressive collapse, breakpoints, hamburger toggle)
- `process/planner/task-plan-v2.md` (Cycle 2 tasks: TASK-024, TASK-014, TASK-015, TASK-017, TASK-021, TASK-018, TASK-025, TASK-026, TASK-019, TASK-020)
- `process/devops/environment-contract-v1.md` (environment variables, builder programming contract)
**Produce:**
- New file stubs, route stubs, component stubs, and dependency additions for Cycle 2 tasks
- No implementation logic -- only signatures, empty functions, TODO markers, and structural wiring
**Return to:** Orchestrator when complete

---

## What Already Exists (Cycle 1 output -- do NOT overwrite)

The entire Cycle 1 codebase is in place and working. All 14 Cycle 1 tasks are COMPLETE with 448+ tests passing. The Scaffolder must EXTEND the existing code, not replace it.

**Key existing files that must not be overwritten:**
- `backend/src/server.js` -- Express app with middleware chain, route mounting
- `backend/src/routes/auth.js` -- register, login, logout routes (working)
- `backend/src/routes/notes.js` -- CRUD routes for notes (working)
- `backend/src/routes/versions.js` -- version history routes (working)
- `backend/src/routes/health.js` -- health check (working)
- `backend/src/middleware/authenticate.js` -- session validation (working)
- `backend/src/middleware/ownershipGuard.js` -- ownership guard (working)
- `backend/src/models/*` -- User, Note, NoteVersion, Folder models (working)
- `backend/src/services/versionService.js` -- version diff and creation (working)
- `backend/src/config/database.js` -- Sequelize config (working)
- `backend/src/config/session.js` -- session config (working)
- `frontend/src/App.jsx` -- routing (working)
- `frontend/src/pages/WorkspacePage.jsx` -- workspace with editor, sidebar, auto-save (working)
- `frontend/src/components/*` -- all Cycle 1 components (working)
- `frontend/src/api/*` -- auth.js, notes.js, versions.js, client.js (working)
- `frontend/src/hooks/*` -- useAutoSave.js, useVersionTimer.js, useAuth.js (working)
- `Dockerfile`, `Dockerfile.dev`, `docker-compose.dev.yml`, `.github/workflows/ci.yml` -- DevOps (working)
- All migration files in `backend/src/migrations/` (working)
- All test files (working)

---

## Cycle 2 Scaffolding Scope

The Scaffolder adds structural stubs for new functionality. Each stub has a `// TODO: TASK-NNN` marker.

### TASK-024: Rate limiting on auth endpoints

**New dependency in `backend/package.json`:**
- `express-rate-limit` -- rate limiting middleware

**New file:**
- `backend/src/middleware/rateLimiter.js` -- rate limiter configuration for auth endpoints

```js
// TODO: TASK-024
// Export authRateLimiter middleware:
//   - windowMs: 15 * 60 * 1000 (15 minutes)
//   - max: 10 (requests per window per IP)
//   - standardHeaders: true (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
//   - legacyHeaders: false
//   - message: { error: 'Too many requests, please try again later' }
//   - keyGenerator: (req) => req.ip (default)
```

**Modify (add import and apply to auth routes):**
- `backend/src/routes/auth.js` -- apply `authRateLimiter` to `POST /login` and `POST /register`

---

### TASK-014: Full-text search

**New file:**
- `backend/src/services/searchService.js` -- already stubbed from Cycle 1 Scaffolder if present; if not, create it

**New route (add to existing `backend/src/routes/notes.js`):**
- `GET /api/notes/search?q=:query` -- search endpoint

**New frontend component:**
- `frontend/src/components/Search/SearchBar.jsx` -- search input component

**New frontend API function (add to existing `frontend/src/api/notes.js`):**
- `searchNotes(query)` -- calls `GET /api/notes/search?q=:query`

---

### TASK-015: Password reset flow

**New dependency in `backend/package.json`:**
- `crypto` (built-in, no install needed) -- for token generation

**New file:**
- `backend/src/services/emailService.js` -- already stubbed from Cycle 1 Scaffolder if present; if not, create it

**New migration:**
- `backend/src/migrations/` -- `password_reset_tokens` table (if not already created by TASK-002 migration)

**New routes (add to existing `backend/src/routes/auth.js`):**
- `POST /api/auth/forgot-password` -- request password reset
- `POST /api/auth/reset-password` -- execute password reset

**New frontend pages:**
- `frontend/src/pages/ForgotPasswordPage.jsx` -- forgot password form page
- `frontend/src/pages/ResetPasswordPage.jsx` -- reset password form page

**New frontend components:**
- `frontend/src/components/Auth/ForgotPasswordForm.jsx` -- email input form
- `frontend/src/components/Auth/ResetPasswordForm.jsx` -- new password form

**New frontend API functions (add to existing `frontend/src/api/auth.js`):**
- `forgotPassword(email)` -- calls `POST /api/auth/forgot-password`
- `resetPassword(token, newPassword)` -- calls `POST /api/auth/reset-password`

---

### TASK-017: Folder organization

**New file:**
- `backend/src/routes/folders.js` -- folder CRUD routes

**New frontend components:**
- `frontend/src/components/Sidebar/FolderTree.jsx` -- folder navigation in sidebar
- `frontend/src/components/Sidebar/FolderCreateForm.jsx` -- create folder form

**New frontend API file:**
- `frontend/src/api/folders.js` -- createFolder, getFolders, updateFolder, deleteFolder

**Modify (mount folder routes):**
- `backend/src/server.js` -- mount `/api/folders` route

---

### TASK-018: Responsive design

**No new files needed** -- this task modifies existing components (WorkspacePage.jsx, Sidebar, Editor, Preview) with CSS media queries and Tailwind responsive classes.

**New frontend component (optional):**
- `frontend/src/components/Common/HamburgerToggle.jsx` -- sidebar toggle button for tablet/mobile

---

### TASK-025: Keyboard shortcuts

**New frontend hook:**
- `frontend/src/hooks/useKeyboardShortcuts.js` -- global keyboard shortcut handler

**New frontend component:**
- `frontend/src/components/Common/ShortcutReference.jsx` -- keyboard shortcut help overlay

---

### TASK-026: Export notes as Markdown

**No new backend files needed** -- export is client-side only (Blob download).

**New frontend utility:**
- `frontend/src/utils/exportNote.js` -- sanitize filename, create Blob, trigger download

---

### TASK-019: Account deletion

**New route (add to existing `backend/src/routes/auth.js`):**
- `DELETE /api/auth/account` -- delete authenticated user's account

**New frontend component:**
- `frontend/src/components/Auth/DeleteAccountSection.jsx` -- account deletion UI with confirmation

**New frontend page (or section in settings):**
- `frontend/src/pages/AccountSettingsPage.jsx` -- account settings page with delete section

**New frontend API function (add to existing `frontend/src/api/auth.js`):**
- `deleteAccount()` -- calls `DELETE /api/auth/account`

---

### TASK-020: Fitness function instrumentation

**No scaffolding needed** -- this task writes tests against existing code. No new production files.

---

### TASK-021: DevOps Phase 2

**No scaffolding needed** -- this task is handled by the DevOps agent (infrastructure configuration, not application code).

---

## Task-to-File Mapping (for TODO markers)

| File(s) | TODO Task |
|---|---|
| `backend/src/middleware/rateLimiter.js` | TASK-024 |
| `backend/src/services/searchService.js`, `frontend/src/components/Search/SearchBar.jsx` | TASK-014 |
| `backend/src/services/emailService.js`, `frontend/src/pages/ForgotPasswordPage.jsx`, `frontend/src/pages/ResetPasswordPage.jsx`, `frontend/src/components/Auth/ForgotPasswordForm.jsx`, `frontend/src/components/Auth/ResetPasswordForm.jsx` | TASK-015 |
| `backend/src/routes/folders.js`, `frontend/src/components/Sidebar/FolderTree.jsx`, `frontend/src/components/Sidebar/FolderCreateForm.jsx`, `frontend/src/api/folders.js` | TASK-017 |
| `frontend/src/components/Common/HamburgerToggle.jsx` | TASK-018 |
| `frontend/src/hooks/useKeyboardShortcuts.js`, `frontend/src/components/Common/ShortcutReference.jsx` | TASK-025 |
| `frontend/src/utils/exportNote.js` | TASK-026 |
| `frontend/src/components/Auth/DeleteAccountSection.jsx`, `frontend/src/pages/AccountSettingsPage.jsx` | TASK-019 |

---

## What the Scaffolder Must NOT Do

1. **Do NOT overwrite any existing Cycle 1 file.** Only add new files or add new exports/stubs to existing files.
2. **Do NOT implement any business logic.** Every function body should be a stub with a `// TODO: TASK-NNN` comment.
3. **Do NOT write tests.** Tests are written by the Builder as part of each task.
4. **Do NOT create migration files** unless they are clearly new (e.g., password_reset_tokens if not already in schema). Check existing migrations first.
5. **Do NOT modify DevOps files** (Dockerfile, docker-compose, CI workflow).
6. **Do NOT run `npm install`.** Add dependencies to package.json; the Builder handles installation.
7. **Do NOT break existing tests.** All 448+ tests from Cycle 1 must continue to pass.

---

## After Scaffolding

When the Scaffolder returns, the Orchestrator will:
1. Begin the Builder-Verifier iterate loop with TASK-024 (rate limiting)
2. Follow Manifest Rule 1: autonomous sequential dispatch without user prompts
3. Each Builder task is immediately followed by a Verifier invocation
