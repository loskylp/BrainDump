# Routing Instruction
**To:** Builder
**Phase:** EXECUTION -- Cycle 1
**Task:** TASK-003 -- User registration
**Iteration:** 1 of 3
**Load these artifacts:**
- `process/planner/task-plan-v1.md` (TASK-003 section -- acceptance criteria, dependencies, fitness functions)
- `process/scaffolder/scaffold-manifest.md` (exported interfaces, file inventory, complexity signals)
- `process/architect/adr/ADR-002-authentication-sessions.md` (sessions, bcrypt, password hashing decisions)
- `process/architect/adr/ADR-003-data-persistence.md` (schema, FK cascades, UUID PKs)
- `process/architect/adr/ADR-008-design-aesthetic.md` (design tokens, Tailwind config, visual rules)
- `process/devops/environment-contract-v1.md` (environment variables, builder programming contract)
- `process/verifier/verification-report-task-002.md` (predecessor task -- observations that affect TASK-003)
**Produce:**
- Implemented user registration: backend route + service + frontend form + page
- Tests covering all 6 acceptance criteria
**Return to:** Orchestrator when complete

---

## Requirement

**REQ-001: User registration**
A visitor can create an account by providing a username, email address, and password.

## Acceptance Criteria (6 total)

1. A visitor can submit a valid username, email, and password to create an account
2. Password is hashed with bcryptjs (cost factor 12) before storage
3. Email uniqueness enforced by database UNIQUE constraint; duplicate email submission returns a clear error message
4. Password minimum length: 8 characters (server-side validation)
5. On successful registration, a session is created and the user is redirected to the workspace
6. Registration form validates inputs client-side before submission (username, email format, password length)

## What Already Exists

The Scaffolder has pre-created the following files with signatures, contracts, and TODO markers. Your job is to implement the TODO sections -- do NOT restructure or rename the scaffolded interfaces unless there is a technical reason documented in the handoff.

### Backend (already scaffolded and partially implemented)

- **`backend/src/routes/auth.js`** -- `POST /api/auth/register` route is **already fully implemented** by the Scaffolder. It delegates to `authService.register()`, sets `req.session.userId`, and returns 201 with `{ user: { id, username, email } }`. The error handler in `app.js` maps `EMAIL_TAKEN` to 409 and `VALIDATION_ERROR` to 400. **Do not modify this route unless there is a bug.**

- **`backend/src/services/authService.js`** -- `register()` function is **already fully implemented** by the Scaffolder. It validates inputs (username required, email format, password >= 8 chars, username <= 50 chars), hashes with bcryptjs cost factor 12, creates the User row, and handles `SequelizeUniqueConstraintError` -> `EMAIL_TAKEN`. **Do not modify unless there is a bug.**

- **`backend/src/models/User.js`** -- Model is fully defined with fields, toJSON() excluding password_hash. `comparePassword()` is a stub (TODO: TASK-004 -- do NOT implement it in this task).

- **`backend/src/app.js`** -- Express app with middleware chain, auth router mounted at `/api/auth`, centralized error handler. Session middleware is conditionally applied. **Already complete for TASK-003 needs.**

- **`backend/src/config/session.js`** -- Session middleware configuration. Verify this works with `connect-pg-simple`. If it is a stub, implement it -- sessions must work for AC-5 (session created on registration).

### Frontend (already scaffolded)

- **`frontend/src/api/auth.js`** -- `register()` function is **already implemented**: calls `post('/api/auth/register', { username, email, password })`.

- **`frontend/src/api/client.js`** -- fetch wrapper with credentials. **Already implemented by TASK-016.**

- **`frontend/src/components/auth/RegisterForm.jsx`** -- **Already fully implemented** by the Scaffolder with client-side validation (username required, email format, password >= 8 chars), server error handling (EMAIL_TAKEN, VALIDATION_ERROR), and proper form markup with accessibility attributes. **Do not modify unless there is a bug.**

- **`frontend/src/pages/RegisterPage.jsx`** -- **Already fully implemented** by the Scaffolder: wraps RegisterForm, navigates to `/workspace` on success, includes "Already have an account? Log in" link.

### What Needs Implementation

Given the state of the scaffolded files, the Builder's primary responsibilities for TASK-003 are:

1. **Verify session middleware works** -- `backend/src/config/session.js` must be functional. If it is a stub, implement it with `connect-pg-simple` per ADR-002 (httpOnly, secure in production, sameSite: strict, 7-day rolling expiry). The `connect-pg-simple` session table must be created (the library auto-creates it or a migration is needed).

2. **Write tests** covering all 6 acceptance criteria:
   - Backend integration tests for `POST /api/auth/register` (valid registration, duplicate email, password too short, missing fields, session creation)
   - Frontend component tests for RegisterForm (client-side validation, form submission, error handling)
   - End-to-end flow: register -> session established -> can access authenticated state

3. **Verify the existing implementation works end-to-end** -- the scaffolded code may have integration issues (e.g., session store not configured, model associations not loading). Fix any bugs found during test writing.

4. **Ensure the `connect-pg-simple` session table exists** -- either via a migration or the library's auto-creation feature. Without this, sessions will fail silently.

## Technical Context

- **Session store:** `connect-pg-simple` stores sessions in PostgreSQL. The session table (`session`) is either auto-created by the library or must be created via migration. Check ADR-002 for details.
- **Password hashing:** bcryptjs, cost factor 12. Already implemented in `authService.register()`.
- **Error codes:** `EMAIL_TAKEN` (409), `VALIDATION_ERROR` (400). Already mapped in `app.js` error handler.
- **User model:** `toJSON()` excludes `password_hash`. The model is initialized in `models/index.js`.
- **RLS context:** The `rlsContext` middleware sets `SET LOCAL app.current_user_id`. For registration (creating a new user), the user does not exist yet, so the null UUID fallback is used. This is correct behavior -- the `users` table does not have RLS enabled (only `notes`, `folders`, `note_versions` do).
- **OBS-V002-01:** The SET LOCAL / transaction gap noted by the Verifier does not affect TASK-003 because registration only writes to the `users` table (no RLS) and the `session` table (managed by connect-pg-simple, not subject to RLS).

## Fitness Functions

- **FF-D03:** Test suite asserts: protected routes return 401 without a valid session (partially -- this task establishes sessions; full FF-D03 coverage comes with TASK-004)

## Predecessor Handoff Notes

From TASK-002 Builder:
- User.comparePassword() is a stub -- do NOT implement it (TASK-004 scope)
- rlsContext SET LOCAL runs outside transaction context -- does not affect TASK-003 (users table has no RLS)
- Note model uses `forUser(userId)` named scope -- not relevant to TASK-003

## Constraints

- Do NOT modify `tailwind.config.js` (frozen after TASK-016)
- Do NOT implement login, logout, forgot-password, or reset-password routes (those are TASK-004 and TASK-015)
- Do NOT implement `User.comparePassword()` (TASK-004)
- Keep the `TODO: TASK-004` and `TODO: TASK-015` markers in files you do not own
- All tests must pass: both new TASK-003 tests and all existing tests from TASK-016 and TASK-002 (regression check)
