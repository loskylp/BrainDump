# Scaffold Manifest -- BrainDump Cycle 2
**Date:** 2026-03-21 | **Profile:** Commercial | **Cycle:** 2
**Scaffolder version:** 2
**Architecture source:** architecture-overview-v1.md, ADR-002, ADR-003, ADR-005, ADR-008, ADR-009
**Task plan source:** task-plan-v2.md

---

## Summary

Cycle 2 scaffolding extends the Cycle 1 codebase (14/14 tasks COMPLETE, 448+ tests passing) with structural stubs for 8 Builder tasks (TASK-024, TASK-014, TASK-015, TASK-017, TASK-018, TASK-025, TASK-026, TASK-019). Two tasks require no scaffolding (TASK-020 writes tests against existing code; TASK-021 is handled by the DevOps agent).

All new files contain only signatures, docstrings, and `// TODO: TASK-NNN` markers. No logic was implemented. No Cycle 1 files were overwritten.

---

## What Was Already in Place (Cycle 1 -- Not Overwritten)

The following files existed as working stubs or full implementations from the Cycle 1 scaffold. They are relevant to Cycle 2 because the Builder will implement against them.

| File | Cycle 1 Status | Cycle 2 Role |
|---|---|---|
| `backend/src/routes/auth.js` | Implemented (register, login, logout, /me); stubs for forgot-password, reset-password | TASK-024 applies rate limiter; TASK-015 implements existing stubs; TASK-019 adds delete account |
| `backend/src/routes/folders.js` | Fully stubbed (all 5 routes with contracts) | TASK-017 implements |
| `backend/src/routes/search.js` | Fully stubbed (GET /) | TASK-014 implements |
| `backend/src/services/searchService.js` | Fully stubbed with full contract | TASK-014 implements |
| `backend/src/services/emailService.js` | Fully stubbed with full contract | TASK-015 implements |
| `frontend/src/api/auth.js` | Implemented (register, login, logout); stubs for forgotPassword, resetPassword | TASK-015 implements existing stubs; TASK-019 adds deleteAccount (new stub added) |
| `frontend/src/api/search.js` | Fully stubbed (search function) | TASK-014 implements |
| `frontend/src/App.jsx` | Implemented (4 routes: /, /login, /register, /workspace) | TASK-015 and TASK-019 uncomment prepared route stubs |
| `backend/src/migrations/20260319000005-create-password-reset-tokens.js` | Already created in Cycle 1 | No new migration needed for TASK-015 |

---

## New Files Created in This Scaffold Pass

### Backend

#### `backend/src/middleware/rateLimiter.js` -- TASK-024

**Responsibility:** Exports `authRateLimiter` middleware for rate-limiting auth endpoints against brute-force and credential stuffing attacks (SEC-001, ADR-002).

**Exported interface:**
```js
const { authRateLimiter } = require('../middleware/rateLimiter');
// authRateLimiter is currently null (stub); Builder replaces with rateLimit({...})
```

**Configuration contract (for Builder):**
- `windowMs`: `15 * 60 * 1000` (15-minute window)
- `max`: `10` (requests per window per IP)
- `standardHeaders`: `true` -- emit `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`
- `legacyHeaders`: `false` -- suppress `X-RateLimit-*` headers
- On 429: `{ error: 'Too many requests, please try again later' }`
- Key generator: `(req) => req.ip` (default)
- Store: in-memory (acceptable for single-instance deployment per ADR-001)

**New dependency added to `backend/package.json`:**
- `express-rate-limit: ^7.4.0` -- added to `dependencies`; **not installed**; Builder runs `npm install` as first step of TASK-024

---

### Frontend

#### `frontend/src/api/folders.js` -- TASK-017

**Responsibility:** Client-side CRUD functions for folder management endpoints.

**Exported interface:**
```js
getFolders()               // GET /api/folders -> { folders: Array<{ id, name, created_at, updated_at }> }
createFolder(name)         // POST /api/folders -> { folder: { id, name, created_at, updated_at } }
updateFolder(folderId, name) // PUT /api/folders/:id -> { folder: { id, name, updated_at } }
deleteFolder(folderId)     // DELETE /api/folders/:id -> null (204 No Content)
```

---

#### `frontend/src/components/auth/ForgotPasswordForm.jsx` -- TASK-015

**Responsibility:** Email input form for initiating the password reset flow. Shows the same success message regardless of whether the email is registered (no user enumeration per ADR-002 / REQ-003).

**Exported interface:**
```jsx
export default function ForgotPasswordForm()
// Props: none
// Visual states: idle | loading | success | error
// Calls: forgotPassword(email) from api/auth.js
```

---

#### `frontend/src/components/auth/ResetPasswordForm.jsx` -- TASK-015

**Responsibility:** New password form. Reads the raw reset token from `?token=` URL query param via `useSearchParams()`. Client-side validates password length and match before calling API.

**Exported interface:**
```jsx
export default function ResetPasswordForm()
// Props: none; reads token from URL
// Visual states: idle | loading | success | error
// Calls: resetPassword(token, newPassword) from api/auth.js
// On success: shows message with link to /login
```

---

#### `frontend/src/components/auth/DeleteAccountSection.jsx` -- TASK-019

**Responsibility:** Two-step account deletion UI with password confirmation. Calls `deleteAccount(password)` on final confirmation. Parent handles post-deletion navigation.

**Exported interface:**
```jsx
export default function DeleteAccountSection({ onSuccess })
// Props:
//   onSuccess: () => void -- called after successful deletion; parent redirects
// Visual states: idle | confirming | loading | error
// Calls: deleteAccount(password) from api/auth.js
```

---

#### `frontend/src/pages/ForgotPasswordPage.jsx` -- TASK-015

**Responsibility:** Public page at `/forgot-password`. Renders `ForgotPasswordForm` in a centered card layout consistent with `LoginPage`.

**Exported interface:**
```jsx
export default function ForgotPasswordPage()
// Route: /forgot-password (public, no auth guard)
// Renders: ForgotPasswordForm + footer link to /login
```

---

#### `frontend/src/pages/ResetPasswordPage.jsx` -- TASK-015

**Responsibility:** Public page at `/reset-password?token=...`. Validates presence of `?token=` param; if missing, renders error state with link to `/forgot-password`.

**Exported interface:**
```jsx
export default function ResetPasswordPage()
// Route: /reset-password (public, no auth guard)
// Reads: ?token= URL param via useSearchParams()
// Renders: ResetPasswordForm | error state
```

---

#### `frontend/src/pages/AccountSettingsPage.jsx` -- TASK-019

**Responsibility:** Protected page at `/settings`. Contains account management sections. In Cycle 2, the only section is account deletion.

**Exported interface:**
```jsx
export default function AccountSettingsPage()
// Route: /settings (protected via ProtectedRoute in App.jsx)
// Renders: DeleteAccountSection with onSuccess redirect handler
```

---

#### `frontend/src/components/Search/SearchBar.jsx` -- TASK-014

**Responsibility:** Debounced search input. Forwards a ref to the `<input>` element for external focus control (Cmd+K shortcut from `useKeyboardShortcuts`). Delegates result display to the parent via `onResults` callback.

**Exported interface:**
```jsx
export default SearchBar  // React.forwardRef component
// Props:
//   onResults: (Array<{ id, title, snippet }>) => void
//   onError?: (Error) => void  -- optional
//   placeholder?: string  -- default: 'Search notes...'
// Ref: forwarded to <input> element
// Debounce: 300ms recommended
// Calls: search(query) from api/search.js
```

---

#### `frontend/src/components/Sidebar/FolderTree.jsx` -- TASK-017

**Responsibility:** Folder navigation list inside the sidebar. Renders "All Notes" at top plus each folder as a clickable item. Handles rename and delete inline via callbacks.

**Exported interface:**
```jsx
export default function FolderTree({
  folders,           // Array<{ id: string, name: string }>
  activeFolderId,    // string|null -- null means "All Notes" is active
  onFolderSelect,    // (folderId: string|null) => void
  onFolderRenamed,   // (folderId: string, newName: string) => void
  onFolderDeleted,   // (folderId: string) => void
})
// Calls: updateFolder, deleteFolder from api/folders.js
// Uses: ConfirmDialog (existing Cycle 1 component) for delete confirmation
```

---

#### `frontend/src/components/Sidebar/FolderCreateForm.jsx` -- TASK-017

**Responsibility:** Compact inline form for creating a new folder. Validates non-empty name client-side before calling API.

**Exported interface:**
```jsx
export default function FolderCreateForm({
  onCreated,  // ({ id, name, created_at, updated_at }) => void -- called on success
  onCancel?,  // () => void -- optional; shown as Cancel button if provided
})
// Calls: createFolder(name) from api/folders.js
```

---

#### `frontend/src/components/common/HamburgerToggle.jsx` -- TASK-018

**Responsibility:** Sidebar toggle button for tablet/mobile viewports (<1024px). Renders `null` on desktop. Minimum 44px touch target. Accessible with `aria-label` and `aria-expanded`.

**Exported interface:**
```jsx
export default function HamburgerToggle({
  isOpen,    // boolean -- controls aria-expanded and icon (hamburger vs. X)
  onToggle,  // () => void -- called when button is clicked
})
// Returns null at >= 1024px viewport
// Touch target: minimum 44x44px (Tailwind h-11 w-11 or equivalent)
```

**Import path for Builder:** `../components/common/HamburgerToggle.jsx` (lowercase `common`)

---

#### `frontend/src/components/common/ShortcutReference.jsx` -- TASK-025

**Responsibility:** Modal overlay listing all keyboard shortcuts. Shown when `isOpen` is true. Populated from `SHORTCUT_ENTRIES` constant (Builder must keep in sync with `useKeyboardShortcuts` implementation).

**Exported interface:**
```jsx
export default function ShortcutReference({
  isOpen,   // boolean -- renders null when false
  onClose,  // () => void
})
// role="dialog", aria-modal="true", aria-label="Keyboard shortcuts"
// Focus trap: focus stays inside while open; returns to trigger on close
```

**Import path for Builder:** `../components/common/ShortcutReference.jsx` (lowercase `common`)

---

#### `frontend/src/hooks/useKeyboardShortcuts.js` -- TASK-025

**Responsibility:** Global `keydown` event listener for all workspace shortcuts. Registers on mount, cleans up on unmount. All handlers optional.

**Exported interface:**
```js
export function useKeyboardShortcuts({
  onSave?,        // () => void -- Ctrl/Cmd+S (preventDefault applied)
  onNewNote?,     // () => void -- Ctrl/Cmd+N (preventDefault applied)
  onFocusSearch?, // () => void -- Ctrl/Cmd+K (preventDefault applied)
  onBold?,        // () => void -- Ctrl/Cmd+B (editor focus only)
  onItalic?,      // () => void -- Ctrl/Cmd+I (editor focus only)
  onEscape?,      // () => void -- Escape key
  onShowHelp?,    // () => void -- '?' key (not in text input/textarea)
} = {})
// Returns: void
```

---

#### `frontend/src/utils/exportNote.js` -- TASK-026

**Responsibility:** Two pure client-side functions for note-to-Markdown export. No backend round-trip.

**Exported interface:**
```js
export function sanitizeFilename(title: string): string
// Converts note title to filesystem-safe filename stem.
// Algorithm: strip non-[a-zA-Z0-9\-_ ] chars, collapse spaces to hyphens,
//            trim, fallback to 'note' if empty.
// Example: "My Note #1: Overview" -> "My-Note-1-Overview"

export function exportNote(note: { title: string, body: string }): void
// Triggers browser download of note.body as <sanitizedFilename>.md
// Mechanism: Blob('text/markdown;charset=utf-8') -> ObjectURL -> anchor click -> revoke
```

---

## Extension Points Added to Existing Files

All changes to Cycle 1 files are purely additive (comments and stubs). No working code paths were modified.

### `backend/src/routes/auth.js`

Three extension points added:

1. **Commented-out import** near the top:
   ```js
   // TODO: TASK-024 -- uncomment and apply authRateLimiter to /login and /register
   // const { authRateLimiter } = require('../middleware/rateLimiter');
   ```

2. **Rate limiter application stub** on `POST /register`:
   ```js
   // TODO: TASK-024 -- apply authRateLimiter: router.post('/register', authRateLimiter, async ...)
   router.post('/register', async (req, res, next) => { ... });
   ```

3. **Rate limiter application stub** on `POST /login`:
   ```js
   // TODO: TASK-024 -- apply authRateLimiter: router.post('/login', authRateLimiter, async ...)
   router.post('/login', async (req, res, next) => { ... });
   ```

4. **`DELETE /api/auth/account` stub** (TASK-019): Full route with contract docstring added before `module.exports`.

### `frontend/src/api/auth.js`

1. Import updated to include `apiRequest` (needed by `deleteAccount` which must send a DELETE with a body -- the existing `del()` helper does not accept a body).

2. **`deleteAccount(password)` function stub** added after `resetPassword` with full JSDoc contract.

### `frontend/src/App.jsx`

1. **Commented-out imports** for Cycle 2 pages added after the WorkspacePage import:
   ```js
   // TODO: TASK-015 -- uncomment when implementing password reset pages
   // import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
   // import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
   // TODO: TASK-019 -- uncomment when implementing account settings page
   // import AccountSettingsPage from './pages/AccountSettingsPage.jsx';
   ```

2. **Commented-out `<Route>` entries** added inside `<Routes>`:
   ```jsx
   {/* TODO: TASK-015 -- add these routes when implementing password reset */}
   {/* <Route path="/forgot-password" element={<ForgotPasswordPage />} /> */}
   {/* <Route path="/reset-password" element={<ResetPasswordPage />} /> */}
   {/* TODO: TASK-019 -- add this route when implementing account settings */}
   {/* <Route path="/settings" element={<ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} /> */}
   ```

### `backend/package.json`

- Added `"express-rate-limit": "^7.4.0"` to `dependencies`.
- **Not installed.** Builder runs `npm install` as the first step of TASK-024.

---

## What Was Intentionally Left Out

| Item | Reason |
|---|---|
| New migration for `password_reset_tokens` | `20260319000005-create-password-reset-tokens.js` already exists from TASK-002 (Cycle 1). No new migration needed. |
| `GET /api/notes/search` in `notes.js` | Search is already in the separate `backend/src/routes/search.js` (mounted at `/api/search`). The routing instruction reference to `/api/notes/search` is superseded by the existing architecture. Consistent with what is already wired in `app.js`. |
| DevOps files (Dockerfile, docker-compose, CI workflow) | Excluded per routing instruction. TASK-021 is handled by the DevOps agent. |
| Test files | Tests are written by the Builder as part of each task. |
| TASK-020 (Fitness function instrumentation) | No new production files needed. Builder writes tests against existing code. |
| TASK-021 (DevOps Phase 2) | Infrastructure configuration only. No application code scaffolded. |
| `authService.verifyPassword` stub | The `DELETE /api/auth/account` route needs a way to verify the user's password. `authService` already exists and is implemented. The Builder adds a `verifyPassword` method to it (or reuses existing login logic) as part of TASK-019 implementation -- no new scaffold file is needed for this. |

---

## Dependency Order for Builder

### Group 1 -- No Cycle 2 dependencies (all can begin immediately)

Execute in this sequence per the priority matrix (P1 before P2):

1. **TASK-024** -- `rateLimiter.js` + apply to `auth.js` routes. Isolated middleware addition.
2. **TASK-014** -- Implement `searchService.search()`, `search.js` route handler, `api/search.js`, `SearchBar.jsx`. Backend before frontend.
3. **TASK-015** -- Implement `emailService.sendPasswordReset()`, `auth.js` forgot/reset handlers, `api/auth.js` forgotPassword/resetPassword, `ForgotPasswordForm`, `ResetPasswordForm`, pages, App.jsx routes. Backend before frontend.
4. **TASK-017** -- Implement `folders.js` route handlers, `api/folders.js`, `FolderTree`, `FolderCreateForm`. Folder model already exists (Cycle 1 TASK-002).
5. **TASK-018** -- Modify `WorkspacePage.jsx`, Sidebar/Editor/Preview for responsive breakpoints. Add `HamburgerToggle` to workspace. CSS/Tailwind only on frontend.
6. **TASK-025** -- Implement `useKeyboardShortcuts.js`, `ShortcutReference.jsx`. Cmd+K requires `SearchBar` ref (complete TASK-014 first for full integration, but the hook itself can be built independently).
7. **TASK-026** -- Implement `sanitizeFilename`, `exportNote`. Fully client-side. No backend dependency.
8. **TASK-019** -- Implement `auth.js` delete account route, `api/auth.js deleteAccount`, `DeleteAccountSection`, `AccountSettingsPage`. Add App.jsx route. Backend before frontend.

### Group 2 -- Depends on Group 1

9. **TASK-020** -- Write fitness function tests. Depends on TASK-014 (search FF tests need the feature built).

---

## Complexity Signals for Planner

| Element | Signal | Detail |
|---|---|---|
| `searchService.search()` | Medium | PostgreSQL tsquery sanitization has edge cases: empty strings, all-special-char input, single-term vs multi-term prefix handling (last term gets `:*`, all others get `&`). The ADR-005 algorithm is fully specified but implementation requires careful handling of these cases. Timing: search across 200 notes must complete in < 200ms (FF-D24). |
| `emailService.sendPasswordReset()` | Low-Medium | Console provider (development) is trivial. HTTP provider path requires ENV var branching and external HTTP API call with error handling. Complexity in the provider switch and failure mode (`EMAIL_SEND_FAILED`). |
| `auth.js` forgot-password / reset-password | Medium | Token lifecycle (random bytes, hash-only storage, expiry check, atomic deletion, session invalidation for all user sessions) has multiple ordered steps and failure modes. Critical: same response for registered vs unregistered emails (timing safety). |
| Responsive layout (TASK-018) | Medium | Three breakpoints with distinct layout modes. Sidebar overlay transition (0.2s), tab bar for mobile, hamburger for tablet. Touches WorkspacePage, Sidebar, Editor, Preview. CSS Grid-based -- requires Tailwind class composition across breakpoints. Also: `prose-preview` Tailwind class is undefined (OBS-V007-02) and should be resolved during this task. |
| `useKeyboardShortcuts.js` | Low-Medium | Ctrl/Cmd+B and Ctrl/Cmd+I must fire only when CodeMirror editor has focus. Detecting CodeMirror focus via DOM (checking `e.target` ancestry) vs CodeMirror's own focus state API. Browser default conflict avoidance (Ctrl+N, Ctrl+K) requires `preventDefault`. |
| `rateLimiter.js` | Low | Single `rateLimit({...})` call with documented configuration. |
| `FolderTree.jsx` | Low | Standard list with per-item actions. `ConfirmDialog` already exists from Cycle 1. |
| `FolderCreateForm.jsx` | Low | Simple form with one field. |
| `exportNote.js` | Low | Blob + anchor download is well-documented. Sanitization algorithm is fully specified. Edge case: empty title. |
| `SearchBar.jsx` | Low | Debounced input + ref forwarding. Standard patterns. |
| `DeleteAccountSection.jsx` | Low | Two-phase confirmation UI with password field. |

---

## Handoff to Builder

### What was scaffolded
All Cycle 2 Builder task structures are in place. The Builder works against signatures, contracts, and TODO markers. No implementation logic exists in any scaffold file.

### What was intentionally omitted
- `authService.verifyPassword` -- Builder adds this to the existing `authService.js` as needed for TASK-019
- Migration files -- none needed; all schema tables already exist from Cycle 1
- DevOps files -- out of scope for this scaffold pass
- Test files -- Builder's responsibility per task

### Directory note
The routing instruction specified `Common/` (capital C) for HamburgerToggle and ShortcutReference. On the macOS development filesystem, `Common/` and `common/` resolve identically. These files physically exist in `common/` (lowercase) alongside the existing Cycle 1 common components. **The Builder must use lowercase `common` in all import paths** to ensure compatibility with the Linux CI environment where directory names are case-sensitive.

### Observations for Architect
No ambiguities requiring Architect clarification were found during scaffolding. The existing architecture decisions (ADR-002 through ADR-009) provide sufficient guidance for all Cycle 2 components.

One observation for the Builder (OBS-V007-02 carried from Cycle 1): the `prose-preview` Tailwind class used in the Preview component is not defined in `tailwind.config.js`. This should be resolved during TASK-018 when the Tailwind configuration is touched for responsive design.
