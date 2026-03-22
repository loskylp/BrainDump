# Requirements -- BrainDump
**Version:** 3 | **Date:** 2026-03-21 | **Artifact Weight:** Draft
**Brief version:** 2

---

## Changelog
- v1: Initial requirements from Brief v1 -- 2026-03-19
- v2: Revised with Nexus product description -- 2026-03-19. Key changes: REQ-003 promoted to Must Have; REQ-007 rewritten for split-pane CommonMark editor; REQ-010 promoted to Must Have with full-text search specification; new REQ-015 (auto-save) and REQ-016 (version history) added as Must Have; REQ-012 updated to reference PostgreSQL explicitly. Audience refined to developers throughout. Later updated with Nexus clarification: REQ-016 now specifies activity-based versioning with idle detection and diff check; all versions retained indefinitely. REQ-015 clarified to distinguish auto-save (working state) from version creation. All open questions resolved. Later updated with Nexus product vision and persona: REQ-007 sharpened for live rendering testability; REQ-008 rewritten as Note Catalog sidebar component; REQ-010 strengthened with explicit title+body field coverage and persona traceability; audience broadened to technical professionals. Later updated to fix AUDIT-001 (new REQ-017: public landing page) and AUDIT-002 (REQ-015/REQ-016: replaced "significant diff" with concrete 30-second idle timer rule; all ambiguous versioning language removed).
- v3: Mid-cycle requirement creation for two Nexus-requested features that the Planner flagged as untraced to approved requirements. Added REQ-018 (keyboard shortcuts) and REQ-019 (export notes as Markdown). Both are Should Have priority. No existing requirements modified. -- 2026-03-21

---

## Functional Requirements

### REQ-001: User registration
**Statement:** A visitor can create an account by providing a username, email address, and password.
**Origin:** Brief v2 -- Stakeholders (End Users need accounts), Domain Model (User entity)
**Definition of Done:** A visitor submits valid registration data and receives a confirmed account. Duplicate emails are rejected. The user can subsequently log in.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given a visitor on the registration page
When they submit a valid username, email, and password
Then an account is created and they are redirected to their note workspace

Given a visitor on the registration page
When they submit an email that is already registered
Then registration is rejected with a clear error message and no duplicate account is created
```

---

### REQ-002: User login and logout
**Statement:** A registered user can log in with their credentials and log out of an active session.
**Origin:** Brief v2 -- User Roles (Registered User requires authentication)
**Definition of Done:** A registered user can log in with email and password and access their notes. They can log out, after which protected pages are inaccessible until they log in again.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given a registered user on the login page
When they enter valid credentials
Then they are authenticated and redirected to their note workspace

Given an authenticated user
When they click log out
Then their session ends and they cannot access protected pages without logging in again

Given a visitor on the login page
When they enter an incorrect password
Then login is rejected and no session is created
```

---

### REQ-003: Password reset
**Statement:** A registered user who has forgotten their password can request a reset via their registered email address.
**Origin:** Brief v2 -- Open Question 4 (resolved: yes), Ground Truths (professional service developers rely on)
**Definition of Done:** A user can request a password reset, receive an email with a reset link, and set a new password. The reset link expires after a reasonable time. The response does not reveal whether the email is registered (to prevent user enumeration).
**Priority:** Must Have | **Status:** Draft
**Change from v1:** Promoted from Should Have to Must Have per Nexus confirmation.

**Acceptance Scenarios:**
```
Given a registered user on the password reset page
When they enter their registered email and submit
Then a password reset email is sent to that address

Given a user with a valid reset link
When they submit a new password via the reset link
Then their password is updated and they can log in with the new password

Given a user with an expired reset link
When they attempt to use it
Then the reset is rejected and they are prompted to request a new link

Given a visitor who enters an unregistered email on the password reset page
When they submit
Then the same success message is shown as for a registered email (no user enumeration)
```

---

### REQ-004: Create a note
**Statement:** An authenticated user can create a new note by providing a title. The note opens in the split-pane editor for immediate editing.
**Origin:** Brief v2 -- Problem Statement, Scope (creating notes)
**Definition of Done:** A user can create a note with a title. The note is persisted and appears in the note catalog sidebar (REQ-008). Upon creation, the split-pane editor opens with an empty body ready for Markdown input.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user in their workspace
When they create a new note with a title
Then the note is saved, appears in the catalog sidebar, and the split-pane editor opens with the title set and an empty body

Given an authenticated user
When they create a note with a title that already exists in their collection
Then the note is created (duplicate titles are allowed -- titles are not unique identifiers)
```

---

### REQ-005: Edit a note
**Statement:** An authenticated user can edit the title and body of any note they own using the split-pane editor.
**Origin:** Brief v2 -- Scope (editing notes), Ground Truths (split-pane editor)
**Definition of Done:** A user can modify an existing note's title and body in the split-pane editor. Changes are persisted via auto-save (REQ-015). The last modified date is updated on each save.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user opening one of their notes
When the note loads
Then the split-pane editor displays the Markdown source in the left panel and the rendered preview in the right panel

Given an authenticated user editing a note
When they modify the title or body
Then changes are auto-saved and the last modified date is updated

Given an authenticated user
When they attempt to access the editor for a note they do not own
Then access is denied (the note is not accessible to them)
```

---

### REQ-006: Delete a note
**Statement:** An authenticated user can delete any note they own. Deletion removes the note and all its version history.
**Origin:** Brief v2 -- Scope (deleting notes), Domain Invariants (deleting a note deletes all versions)
**Definition of Done:** A user can delete a note. The note and all its versions are removed from their collection and are no longer retrievable. A confirmation step prevents accidental deletion.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user viewing one of their notes
When they request deletion and confirm
Then the note and all its versions are permanently removed

Given an authenticated user
When they request deletion but cancel the confirmation
Then the note is not deleted

Given an authenticated user who has deleted a note
When they search for the deleted note's content
Then no results are returned for that note
```

---

### REQ-007: Split-pane Markdown editor with live preview
**Statement:** The note editing interface is a split-pane layout: the left panel is a text editor with syntax highlighting for Markdown; the right panel is a live Markdown renderer that converts CommonMark syntax to HTML in real time as the user types. There is no manual "render" or "preview" action -- the preview updates continuously and automatically.
**Origin:** Brief v2 -- Ground Truths (split-pane editor, live rendering, CommonMark standard, syntax highlighting), Persona (Carla the Writer -- intuitive for non-developers)
**Definition of Done:** The editor displays two panels side by side. The left panel provides syntax highlighting for CommonMark Markdown elements (headings, bold, italic, links, lists, code blocks, inline code). The right panel performs real-time syntax-to-HTML conversion: every edit in the source panel is reflected in the preview without user-initiated action and with no perceptible delay under normal conditions. The rendering conforms to the CommonMark specification. The interface is professional/technical in aesthetic and intuitive enough for non-developer users.
**Priority:** Must Have | **Status:** Draft
**Change from v1:** Rewritten. Was "Render Markdown" (view-only rendering). Now specifies the split-pane editing experience with syntax highlighting and live CommonMark preview as described by the Nexus. Updated with explicit live-rendering testability and persona traceability.

**Acceptance Scenarios:**
```
Given an authenticated user editing a note
When they type CommonMark Markdown in the left panel (e.g., headings, bold, code blocks, links, lists)
Then the right panel updates in real time to show the rendered HTML without any manual "render" or "refresh" action

Given an authenticated user editing a note
When they type a single character in the source panel
Then the preview panel reflects the change within a perceptible "instant" response (no visible lag under normal network and load conditions)

Given an authenticated user editing a note with a fenced code block
When the code block is displayed in the left panel
Then the Markdown syntax is highlighted (distinct visual treatment for code fence markers, language identifiers, and code content)

Given a note containing CommonMark-valid Markdown
When rendered in the preview panel
Then the output conforms to the CommonMark specification (e.g., ATX headings, emphasis rules, link syntax all parse correctly)

Given a non-developer user (e.g., Carla the Writer) using the editor for the first time
When they type Markdown formatting (e.g., **bold**, # heading)
Then the split-pane layout and live preview are self-explanatory without requiring documentation or training

Given the editor on a viewport narrower than the split-pane minimum (mobile)
When the user is editing
Then the editor degrades gracefully (e.g., tabbed panels or stacked layout rather than broken side-by-side)
```

---

### REQ-008: Note catalog (sidebar)
**Statement:** The workspace includes a persistent note catalog displayed as a sidebar. The catalog lists all of the user's notes sorted by last modified date (newest first) by default. It is a distinct, always-visible UI component that serves as the primary navigation for the note collection -- not a separate page the user must navigate to.
**Origin:** Brief v2 -- Ground Truths (note catalog sidebar), Scope (finding notes), Domain Model (Note entity attributes), Persona (Carla the Writer -- at-a-glance collection management)
**Definition of Done:** The sidebar is visible alongside the editor in the workspace layout. It lists all notes with each entry showing at minimum the note title and last modified date. Notes are sorted by last modified date (newest first) by default. Clicking a note in the catalog opens it in the editor. The catalog remains accessible while a note is being edited. The catalog handles large collections (dozens to hundreds of notes) without becoming unreadable or unusably slow.
**Priority:** Must Have | **Status:** Draft
**Change from v1:** Rewritten. Was "List notes" (generic list). Now specifies the note catalog as a persistent sidebar component per Nexus feature description, with persona-driven readability requirements.

**Acceptance Scenarios:**
```
Given an authenticated user with multiple notes
When they view their workspace
Then a sidebar catalog is visible listing all their notes, sorted by last modified date (newest first)

Given an authenticated user viewing the catalog sidebar
When they click on a note entry
Then that note opens in the split-pane editor and the catalog remains visible

Given an authenticated user editing a note
When they look at the workspace layout
Then the catalog sidebar is still visible and navigable alongside the editor

Given an authenticated user with no notes
When they view the catalog sidebar
Then an empty state is shown with guidance on how to create their first note

Given a user like Carla with 200 bibliographic source notes
When she views the catalog sidebar
Then the catalog renders without perceptible delay and is scrollable with readable note titles and dates
```

---

### REQ-009: Organize notes in folders
**Statement:** An authenticated user can create, rename, and delete single-level folders, and move notes into or out of folders.
**Origin:** Brief v2 -- Scope (organizing notes), Domain Model (Folder entity), Open Question 1 (resolved: folders confirmed)
**Definition of Done:** Users can create folders, rename them, delete them, and assign notes to folders. Notes without a folder appear at the root level. Deleting a folder moves its notes to the root level (notes are not deleted). Folders are single-level only in v1 (no nesting).
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user
When they create a folder with a valid name
Then the folder appears in their workspace navigation

Given an authenticated user with a note at root level
When they move that note into an existing folder
Then the note appears inside that folder and no longer at root level

Given an authenticated user with a folder containing notes
When they delete that folder
Then the folder is removed and its notes are moved to root level

Given an authenticated user
When they attempt to create a folder inside another folder
Then the action is not available (nested folders are not supported in v1)
```

---

### REQ-010: Full-text search
**Statement:** An authenticated user can search their notes using an indexed full-text search engine that covers both the note title and the note body. Search is backed by PostgreSQL full-text indexing for fast, relevance-ranked results.
**Origin:** Brief v2 -- Ground Truths (full-text search with indexed metadata), Scope, Persona (Carla the Writer -- searches by keyword across hundreds of notes)
**Definition of Done:** A search input accepts a text query and returns matching notes from the user's collection. The search index covers both the title field and the body field of every note -- a match in either field returns the note. Search uses PostgreSQL full-text search capabilities (not application-level string matching or sequential scan). Results are ranked by relevance. Search performance remains fast as the user's collection grows to hundreds of notes.
**Priority:** Must Have | **Status:** Draft
**Change from v1:** Promoted from Should Have to Must Have. Specification tightened to require PostgreSQL full-text indexing per Nexus description. Updated with explicit dual-field (title + body) coverage and persona traceability.

**Acceptance Scenarios:**
```
Given an authenticated user with a note titled "PostgreSQL Indexing" and a body that does not contain the word "PostgreSQL"
When they search for "PostgreSQL"
Then that note is returned (title field is searched)

Given an authenticated user with a note titled "Meeting Notes" whose body contains "discussed PostgreSQL migration"
When they search for "PostgreSQL"
Then that note is returned (body field is searched)

Given an authenticated user with notes matching a query in both title and body
When they search
Then all matching notes are returned regardless of which field matched, ranked by relevance

Given a user like Carla with 200 notes
When she searches for an author name that appears in 5 notes
Then those 5 notes are returned promptly without perceptible delay

Given an authenticated user
When they search for a term that matches no notes
Then an empty result set is displayed with a clear message

Given an authenticated user performing a search
When results are returned
Then only that user's notes appear in the results (per-user isolation is enforced)
```

---

### REQ-011: Per-user data isolation
**Statement:** A user can only view, edit, and delete their own notes, note versions, and folders. No user can access another user's data through any interface.
**Origin:** Brief v2 -- Domain Invariants (cross-user visibility does not exist), Ground Truths
**Definition of Done:** All data access endpoints enforce ownership. Attempting to access another user's note, version, or folder by any means (direct URL, API call, search) returns no data or an authorization error.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given two users, Alice and Bob, each with their own notes
When Alice requests Bob's note by direct URL or ID
Then the request is denied or returns not found -- Alice sees no data belonging to Bob

Given two users, Alice and Bob
When Alice performs a search
Then only Alice's notes are included in the results, never Bob's

Given two users, Alice and Bob
When Alice attempts to access a version history entry belonging to Bob's note
Then access is denied
```

---

## Non-Functional Requirements

### REQ-012: Data durability and PostgreSQL persistence
**Statement:** User data (notes, note versions, folders, account information) must be persisted in PostgreSQL. The system must protect against data loss from application failures, server restarts, and routine infrastructure events.
**Origin:** Brief v2 -- Ground Truths (data durability, PostgreSQL), Manifest -- Infrastructure Preconditions
**Definition of Done:** All data is stored in PostgreSQL with referential integrity enforced by the database. The architecture includes a backup strategy that is documented and testable. A simulated application restart does not result in data loss.
**Priority:** Must Have | **Status:** Draft
**Change from v1:** Updated to name PostgreSQL explicitly as a Nexus-decided constraint, not an Architect choice. Added referential integrity requirement.

**Acceptance Scenarios:**
```
Given a user who has created and auto-saved notes
When the application server restarts
Then all previously saved notes and their versions are intact and accessible after restart

Given the PostgreSQL database
When a backup is executed
Then a restorable backup artifact is produced and its integrity can be verified

Given a note with associated folder membership and version history
When the database schema is inspected
Then foreign key constraints enforce referential integrity between notes, versions, folders, and users
```

---

### REQ-013: Responsive web design
**Statement:** The web application must be usable on desktop and mobile browsers. The workspace layout (catalog sidebar + split-pane editor) must degrade gracefully on narrow viewports.
**Origin:** Brief v2 -- Delivery Channel, Ground Truths
**Definition of Done:** Key pages (login, workspace with catalog and editor) render correctly on viewports from 375px (mobile) to 1920px (desktop). On narrow viewports where the three-panel layout (catalog + source + preview) is impractical, the UI provides an alternative layout (e.g., collapsible sidebar, tabbed or stacked editor panels). No horizontal scrollbar appears on any page.
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given the workspace on a 1920px-wide viewport
When the user is editing a note
Then the catalog sidebar, source editor panel, and preview panel are all visible simultaneously

Given the workspace on a 375px-wide viewport
When the user is editing a note
Then the catalog sidebar is collapsed or accessible via a toggle, and the editor provides an alternative layout (tabbed or stacked) rather than a broken three-panel view

Given any page in the application
When viewed on a 375px-wide viewport
Then no horizontal scrollbar appears and all interactive elements are reachable
```

---

### REQ-014: Account deletion
**Statement:** A registered user can delete their own account. Deleting an account permanently removes all associated notes, note versions, folders, and personal data.
**Origin:** Brief v2 -- Ground Truths (users should be able to delete their own data), Open Question 5
**Definition of Done:** A user can initiate account deletion from their account settings. After confirmation, the account and all associated data (notes, versions, folders) are permanently deleted. The user can no longer log in.
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user on their account settings page
When they request account deletion and confirm
Then their account, notes, versions, and folders are permanently deleted and they cannot log in

Given an authenticated user
When they request account deletion but cancel the confirmation
Then no data is deleted and the account remains active
```

---

### REQ-015: Auto-save
**Statement:** Notes are saved automatically as the user edits in the split-pane editor. No manual save action is required. Auto-save persists the current working state on a short debounce timer. It is distinct from version creation (REQ-016), which operates on a separate 30-second idle timer. The two mechanisms are non-overlapping: auto-save updates the working state; version creation snapshots it for recovery.
**Origin:** Brief v2 -- Ground Truths (auto-save mechanism reduces friction and prevents data loss)
**Definition of Done:** When a user edits a note, changes are persisted automatically after a short debounce period (no explicit save button required). The user receives a visual indicator of save status (saving, saved, error). If the browser is closed or crashes after the debounce period has elapsed, no content is lost. Auto-save updates the current working state only -- it does not create version history entries (that is REQ-016's responsibility on its own 30-second timer).
**Priority:** Must Have | **Status:** Draft
**New in v2. Updated per AUDIT-002 to clarify non-overlapping relationship with REQ-016.**

**Acceptance Scenarios:**
```
Given an authenticated user editing a note in the split-pane editor
When they stop typing for the short debounce period
Then the current content is automatically saved and a visual indicator confirms the save

Given an authenticated user editing a note
When they navigate away from the editor after the debounce period
Then all changes are persisted without requiring a manual save action

Given an authenticated user editing a note
When auto-save fires multiple times during an active editing session (each debounce cycle)
Then the working state is updated each time but no version history entry is created (version creation is governed solely by REQ-016's 30-second idle timer)

Given an authenticated user editing a note
When auto-save fails (e.g., network error)
Then a visual error indicator is shown so the user knows their changes are not yet persisted

Given an authenticated user editing a note
When they make changes and immediately close the browser tab before debounce completes
Then changes made before the last successful auto-save are preserved (content since last save may be lost -- this is acceptable)
```

---

### REQ-016: Note version history
**Statement:** The system maintains a version history for each note using a 30-second idle timer. A new version is created when (a) 30 seconds of user inactivity have elapsed AND (b) the note content has changed compared to the last version (any change -- there is no subjective "significance" threshold). If 30 seconds of inactivity elapse with no change from the last version, no version is created. All versions are retained indefinitely -- no pruning or cap. Users can view previous versions and restore a note to a prior state.
**Origin:** Brief v2 -- Ground Truths (version history with time-based idle trigger), Nexus clarification on versioning granularity (AUDIT-002) and retention
**Definition of Done:** Each note has a version history accessible to its owner. New versions are created automatically when the 30-second idle timer fires and the content differs from the last version. The change check is a binary diff (any difference counts). The user can view a list of prior versions with timestamps. The user can view the content of any prior version. The user can restore a note to a previous version (which creates a new version with the restored content). All versions are kept indefinitely. Version history is deleted only when the parent note is deleted.
**Priority:** Must Have | **Status:** Draft
**New in v2. Updated per AUDIT-002: replaced "significant diff" / "meaningful change" with concrete 30-second idle timer + any-change rule. Acceptance scenarios are now deterministic and testable with a timer mock.**

**Acceptance Scenarios:**
```
Given an authenticated user editing a note continuously (no pause >= 30 seconds)
When they have been typing without a 30-second gap
Then no new version is created during the active editing period (the 30-second idle timer has not fired)

Given an authenticated user who has edited a note and then stops
When 30 seconds of inactivity elapse and the content differs from the last version (even by a single character)
Then a new version is automatically created and added to the version history

Given an authenticated user who has edited a note, stopped, and a version was created
When they do not edit further and another 30 seconds of inactivity elapse
Then no additional version is created (content has not changed since the last version)

Given an authenticated user who opens a note and makes no edits
When 30 seconds of inactivity elapse
Then no version is created (no change detected)

Given an authenticated user viewing one of their notes
When they open the version history
Then a list of all prior versions is displayed with timestamps, ordered newest first

Given an authenticated user viewing a note's version history
When they select a prior version
Then the content of that version is displayed (read-only)

Given an authenticated user viewing a prior version of a note
When they choose to restore that version
Then the note's current content is replaced with the restored version's content and a new version entry is created (preserving the state before restoration)

Given an authenticated user who has just created a new note
When they open the version history
Then the history contains the initial version

Given a note with 100 versions
When the user views the version history
Then all 100 versions are accessible (no pruning has occurred)
```

---

### REQ-017: Public landing page
**Statement:** Unauthenticated visitors are served a public landing page that describes the application, highlights its key features, and presents a prominent registration call-to-action (CTA) on the side of the page. The landing page is the entry point for new users and must convey the professional/technical identity of BrainDump.
**Origin:** Brief v2 -- Open Question 3 (resolved per AUDIT-001), User Roles (Anonymous Visitor), Ground Truths (professional/technical design aesthetic)
**Definition of Done:** An unauthenticated visitor accessing the application root URL sees a landing page containing: (1) an app description explaining what BrainDump is, (2) feature highlights summarizing key capabilities (Markdown editor, live preview, search, version history), and (3) a registration CTA prominently positioned on the side. The page also provides a link or path to log in for existing users. The page reflects the professional/technical design aesthetic. All note functionality remains behind authentication.
**Priority:** Must Have | **Status:** Draft
**New -- added per AUDIT-001.**

**Acceptance Scenarios:**
```
Given an unauthenticated visitor
When they navigate to the application root URL
Then they see a landing page with an app description, feature highlights, and a registration CTA on the side

Given an unauthenticated visitor viewing the landing page
When they look for a way to create an account
Then a registration CTA is prominently visible on the side of the page (not buried in navigation or footer)

Given an unauthenticated visitor viewing the landing page
When they look for a way to log in
Then a login link or button is accessible from the landing page

Given an unauthenticated visitor viewing the landing page
When they attempt to access note functionality (e.g., editor, catalog, search) directly by URL
Then they are redirected to the login page or the landing page (note functionality is not accessible without authentication)

Given an unauthenticated visitor viewing the landing page
When they evaluate the visual design
Then the page reflects the professional/technical aesthetic consistent with the rest of the application
```

---

### REQ-018: Keyboard shortcuts
**Statement:** The workspace provides keyboard shortcuts for common editing and navigation actions, enabling keyboard-driven workflows for technical professionals. Shortcuts cover note management (save, new note), editor formatting (bold, italic), navigation (focus search, close overlays), and are discoverable via a shortcut reference overlay. All shortcuts use the platform-appropriate modifier key (Cmd on macOS, Ctrl on Windows/Linux).
**Origin:** Nexus feature request at Cycle 2 Plan Gate. Traced to Brief v2 -- Ground Truths (target audience: technical professionals who prefer keyboard-driven workflows), Persona (Carla the Writer -- reducing friction between thinking and writing).
**Definition of Done:** The workspace responds to the defined keyboard shortcuts. Each shortcut performs its documented action without conflicting with browser defaults or assistive technology bindings. A shortcut reference overlay is accessible via the `?` key (when no text input is focused) or a help button in the workspace, listing all available shortcuts. Shortcuts are implemented via a centralized hook (`useKeyboardShortcuts`) that prevents default browser behavior only for the shortcuts it handles.
**Priority:** Should Have | **Status:** Draft
**New in v3. Addresses Planner traceability gap for TASK-025.**

**Acceptance Scenarios:**
```
Given an authenticated user editing a note in the workspace
When they press Cmd/Ctrl + S
Then the current note is saved immediately (manual save complement to auto-save) and the save status indicator updates

Given an authenticated user in the workspace (not focused on a text input)
When they press Cmd/Ctrl + N
Then a new note is created and opened in the editor

Given an authenticated user in the workspace
When they press Cmd/Ctrl + K
Then the search input receives focus so the user can begin typing a search query

Given an authenticated user editing a note with text selected in the source panel
When they press Cmd/Ctrl + B
Then the selected text is wrapped with ** (bold Markdown syntax); if the selection is already bold-wrapped, the ** markers are removed (toggle behavior)

Given an authenticated user editing a note with text selected in the source panel
When they press Cmd/Ctrl + I
Then the selected text is wrapped with _ (italic Markdown syntax); if the selection is already italic-wrapped, the _ markers are removed (toggle behavior)

Given an authenticated user with an open overlay (sidebar on mobile, version history panel, or shortcut reference)
When they press Escape
Then the overlay is closed and focus returns to the previously active element

Given an authenticated user in the workspace (not focused on a text input)
When they press the ? key
Then the shortcut reference overlay opens, listing all available shortcuts with their key combinations and descriptions

Given an authenticated user in the workspace
When they press Cmd/Ctrl + K
Then the browser's default address-bar-focus behavior is prevented and the in-app search input receives focus instead

Given an authenticated user using a screen reader
When they navigate the workspace
Then keyboard shortcuts do not conflict with screen reader navigation keys (e.g., shortcuts do not capture arrow keys, Tab, or single-letter keys used by screen readers in browse mode)

Given the shortcut reference overlay
When the user views it
Then each shortcut entry shows the key combination (with platform-appropriate modifier label), the action it performs, and the context in which it is active (e.g., "Editor", "Workspace", "Any")
```

**Fitness Functions (from TASK-025):**
- All defined shortcuts trigger their documented action
- No shortcut conflicts with browser defaults that cannot be overridden (Cmd/Ctrl+W, Cmd/Ctrl+T, Cmd/Ctrl+L are not used)
- Shortcut reference overlay is accessible and lists all shortcuts
- Shortcuts use `useKeyboardShortcuts` hook -- no ad-hoc `addEventListener` calls outside the hook

---

### REQ-019: Export notes as Markdown
**Statement:** An authenticated user can export any note they own as a `.md` file containing the raw Markdown source. The export is a client-side download -- no server round-trip is required when the note content is already loaded in the editor. The exported filename is derived from the note title, sanitized for filesystem safety.
**Origin:** Nexus feature request at Cycle 2 Plan Gate. Traced to Brief v2 -- Problem Statement (removing friction, data portability), Ground Truths (Markdown is the source of truth), Domain Invariants (Note stores CommonMark Markdown source as the authoritative content).
**Definition of Done:** An "Export" button is visible in the editor toolbar alongside Save, History, and Delete. Clicking it triggers a browser download of a `.md` file containing the note's raw Markdown body. The filename is the note title sanitized for filesystem safety (special characters removed or replaced, whitespace replaced with hyphens, truncated to a reasonable length). The download uses the browser's native download mechanism (Blob + URL.createObjectURL). No backend API endpoint is required. Export is only available for the currently loaded note owned by the authenticated user.
**Priority:** Should Have | **Status:** Draft
**New in v3. Addresses Planner traceability gap for TASK-026.**

**Acceptance Scenarios:**
```
Given an authenticated user editing a note titled "My Research Notes" with Markdown content in the body
When they click the Export button in the editor toolbar
Then a file named "my-research-notes.md" is downloaded containing the exact raw Markdown source of the note body

Given an authenticated user editing a note titled "Notes: Week 3 (Draft!)"
When they click the Export button
Then the downloaded filename is sanitized to "notes-week-3-draft.md" (special characters removed, spaces replaced with hyphens, lowercased)

Given an authenticated user editing a note with an empty body
When they click the Export button
Then a .md file is still downloaded (containing no body content or only the title as a heading) -- the export does not fail or silently do nothing

Given an authenticated user editing a note
When they click Export
Then the download completes without a network request to the backend (client-side Blob download from the editor's in-memory content)

Given an authenticated user viewing the editor toolbar
When they look at the available actions
Then the Export button is visible alongside Save, History, and Delete, with a clear label or icon indicating "download" or "export"

Given an authenticated user editing a note with a very long title (e.g., 200 characters)
When they click Export
Then the filename is truncated to a reasonable length (no longer than 100 characters before the .md extension) to avoid filesystem errors

Given an authenticated user who does not own the currently displayed note (edge case -- ownership guard)
When the Export button would be rendered
Then it is either not visible or disabled (export respects the same ownership rules as edit and delete)
```

**Fitness Functions (from TASK-026):**
- Export produces a valid `.md` file with raw Markdown content (not rendered HTML)
- Filename sanitization removes or replaces characters not safe for Windows, macOS, and Linux filesystems
- No backend API call is made during export when the note content is already loaded
- Export button is present in the editor toolbar

---

## Requirements Traceability Summary

| REQ | Traces to Brief v2 section | Priority | Change from v1 |
|---|---|---|---|
| REQ-001 | Stakeholders, Domain Model (User) | Must Have | -- |
| REQ-002 | User Roles (Registered User) | Must Have | -- |
| REQ-003 | Open Question 4 (resolved), Ground Truths | Must Have | Promoted from Should Have |
| REQ-004 | Problem Statement, Scope | Must Have | Updated: opens split-pane editor |
| REQ-005 | Scope, Ground Truths (split-pane) | Must Have | Updated: references split-pane and auto-save |
| REQ-006 | Scope, Domain Invariants | Must Have | Updated: deletion includes versions |
| REQ-007 | Ground Truths (split-pane, live rendering, CommonMark, syntax highlighting), Persona (Carla) | Must Have | Rewritten: split-pane CommonMark editor; updated with live-rendering testability and persona |
| REQ-008 | Ground Truths (note catalog sidebar), Scope, Domain Model (Note), Persona (Carla) | Must Have | Rewritten: note catalog sidebar component |
| REQ-009 | Scope, Domain Model (Folder), Open Question 1 (resolved) | Should Have | Clarified: single-level only |
| REQ-010 | Ground Truths (full-text search, PostgreSQL indexing), Persona (Carla) | Must Have | Promoted from Should Have; updated with explicit title+body coverage and persona |
| REQ-011 | Domain Invariants, Ground Truths | Must Have | Updated: includes note versions |
| REQ-012 | Ground Truths (PostgreSQL, durability), Manifest | Must Have | Updated: names PostgreSQL |
| REQ-013 | Delivery Channel, Ground Truths | Should Have | Updated: split-pane degradation |
| REQ-014 | Ground Truths, Open Question 5 | Should Have | Updated: includes versions in deletion |
| REQ-015 | Ground Truths (auto-save) | Must Have | NEW in v2; updated per AUDIT-002 (non-overlapping with REQ-016) |
| REQ-016 | Ground Truths (versioning), AUDIT-002 | Must Have | NEW in v2; updated per AUDIT-002 (30-second idle timer, any-change rule) |
| REQ-017 | Open Question 3 (AUDIT-001), User Roles (Anonymous Visitor), Ground Truths (aesthetic) | Must Have | NEW in v2 per AUDIT-001 |
| REQ-018 | Nexus Cycle 2 Plan Gate request, Ground Truths (technical professionals), Persona (Carla) | Should Have | NEW in v3 |
| REQ-019 | Nexus Cycle 2 Plan Gate request, Problem Statement (data portability), Domain Invariants (Markdown as source of truth) | Should Have | NEW in v3 |

---

## Handoff Notes for Auditor

**What changed in v3 compared to v2:**

Two new requirements added. No existing requirements (REQ-001 through REQ-017) were modified.

1. **REQ-018 (Keyboard shortcuts) -- NEW:** Formalizes the Nexus's Cycle 2 Plan Gate request for productivity keyboard shortcuts. Covers six shortcut bindings (Cmd/Ctrl+S save, Cmd/Ctrl+N new note, Cmd/Ctrl+K focus search, Cmd/Ctrl+B bold, Cmd/Ctrl+I italic, Escape close overlay) plus a `?`-triggered shortcut reference overlay. Acceptance scenarios include positive cases for each shortcut, conflict avoidance with browser defaults, accessibility (screen reader non-interference), and discoverability (reference overlay content). Priority: Should Have. Traced to Brief v2 Ground Truths (technical professional audience) and Persona (Carla -- friction reduction). Closes the traceability gap flagged by the Planner for TASK-025.

2. **REQ-019 (Export notes as Markdown) -- NEW:** Formalizes the Nexus's Cycle 2 Plan Gate request for note export. Covers client-side Blob download of raw Markdown source with sanitized filename derived from note title. Acceptance scenarios include the happy path, filename sanitization with special characters, empty body edge case, long title truncation, client-side-only constraint (no backend call), toolbar placement, and ownership guard. Priority: Should Have. Traced to Brief v2 Problem Statement (data portability, friction reduction) and Domain Invariants (Markdown as source of truth). Closes the traceability gap flagged by the Planner for TASK-026.

**Auditor flags from previous cycles addressed in v3:**
- None. This is a mid-cycle addendum, not a response to Auditor flags. All prior Auditor flags (AUDIT-001, AUDIT-002) were addressed in v2.

**Requirements the Analyst is uncertain about:**

- **REQ-018, scenario: Cmd/Ctrl+K overriding browser default.** Most browsers use Cmd/Ctrl+K for address bar focus. The requirement specifies that the app should `preventDefault` on this combination to focus the in-app search instead. This is a common pattern in web applications (VS Code, Notion, Slack all do this), but the Auditor should confirm this is acceptable. If the Nexus disagrees, an alternative binding (e.g., `/` to focus search, as in GitHub) should be considered.

- **REQ-019, scenario: empty body export.** The requirement specifies that exporting a note with an empty body should still produce a downloadable file (not fail silently). The Analyst has drafted the scenario to produce an empty `.md` file or one containing only the title as a heading. The Nexus may prefer one behavior over the other -- flagged for scrutiny.

**Open question for Brief v2 update:**
- Brief v2 Open Question 2 stated that note export was "explicitly out of scope for v1." The Nexus has now requested export at the Cycle 2 Plan Gate, which supersedes that earlier scoping decision. The Brief should be updated in a future pass to reflect this change. This does not block the requirement.
