# Requirements -- BrainDump
**Version:** 1 | **Date:** 2026-03-19 | **Artifact Weight:** Draft
**Brief version:** 1

---

## Changelog
- v1: Initial requirements from Brief v1 -- 2026-03-19

---

## Functional Requirements

### REQ-001: User registration
**Statement:** A visitor can create an account by providing a username, email address, and password.
**Origin:** Brief -- Stakeholders (End Users need accounts), Domain Model (User entity)
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
**Origin:** Brief -- User Roles (Registered User requires authentication)
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
**Origin:** Brief -- Open Question 4 (default assumption: yes for v1), Ground Truths (users rely on service)
**Definition of Done:** A user can request a password reset, receive an email with a reset link, and set a new password. The reset link expires after a reasonable time.
**Priority:** Should Have | **Status:** Draft

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
```

---

### REQ-004: Create a note
**Statement:** An authenticated user can create a new note by providing a title and Markdown-formatted body.
**Origin:** Brief -- Problem Statement, Scope (creating Markdown notes)
**Definition of Done:** A user can create a note with a title and body. The note is persisted and appears in the user's note list. The body accepts Markdown syntax.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user in their workspace
When they create a new note with a title and Markdown body
Then the note is saved and appears in their note list with the correct title

Given an authenticated user
When they create a note with Markdown syntax (e.g., headings, bold, lists)
Then the Markdown source is stored exactly as entered
```

---

### REQ-005: Edit a note
**Statement:** An authenticated user can edit the title and body of any note they own.
**Origin:** Brief -- Scope (editing notes)
**Definition of Done:** A user can modify an existing note's title and body. Changes are persisted. The last modified date is updated.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user viewing one of their notes
When they modify the title or body and save
Then the changes are persisted and the last modified date is updated

Given an authenticated user
When they attempt to edit a note they do not own
Then the edit is denied (the note is not accessible to them)
```

---

### REQ-006: Delete a note
**Statement:** An authenticated user can delete any note they own.
**Origin:** Brief -- Scope (deleting notes), Ground Truths (users should be able to delete their own data)
**Definition of Done:** A user can delete a note. The note is removed from their note list and is no longer retrievable. A confirmation step prevents accidental deletion.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user viewing one of their notes
When they request deletion and confirm
Then the note is permanently removed from their note list

Given an authenticated user
When they request deletion but cancel the confirmation
Then the note is not deleted
```

---

### REQ-007: Render Markdown
**Statement:** When a user views a note, the Markdown body is rendered as formatted HTML.
**Origin:** Brief -- Ground Truths (Markdown is the primary authoring experience), Domain Model (rendered HTML is a derived view)
**Definition of Done:** Note bodies written in Markdown are displayed as rendered HTML when viewed. Standard Markdown features are supported: headings, bold, italic, links, lists (ordered and unordered), code blocks, and inline code.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given a note with Markdown content including headings, bold text, and a code block
When an authenticated user views that note
Then the content is rendered as formatted HTML with correct heading levels, bold styling, and syntax-highlighted code block

Given a note with a Markdown link
When the user views that note
Then the link is rendered as a clickable HTML anchor
```

---

### REQ-008: List notes
**Statement:** An authenticated user can view a list of all their notes, ordered by last modified date (newest first).
**Origin:** Brief -- Scope (finding notes), Domain Model (Note entity attributes)
**Definition of Done:** The user's workspace displays all their notes in reverse chronological order by last modified date. Each list entry shows the note title and last modified date.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user with multiple notes
When they view their note list
Then all their notes are displayed, ordered by last modified date (newest first)

Given an authenticated user with no notes
When they view their note list
Then an empty state is shown with guidance on how to create a note
```

---

### REQ-009: Organize notes in folders
**Statement:** An authenticated user can create, rename, and delete folders, and move notes into or out of folders.
**Origin:** Brief -- Scope (organizing notes), Domain Model (Folder entity)
**Definition of Done:** Users can create folders, rename them, delete them, and assign notes to folders. Notes without a folder appear at the root level. Deleting a folder moves its notes to the root level (notes are not deleted).
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user
When they create a folder with a valid name
Then the folder appears in their workspace

Given an authenticated user with a note at root level
When they move that note into an existing folder
Then the note appears inside that folder and no longer at root level

Given an authenticated user with a folder containing notes
When they delete that folder
Then the folder is removed and its notes are moved to root level
```

---

### REQ-010: Search notes
**Statement:** An authenticated user can search their notes by title and body content.
**Origin:** Brief -- Scope (searching/finding notes)
**Definition of Done:** A search input accepts a text query and returns matching notes from the user's collection. Matches in both title and body are returned. Results are displayed in relevance or recency order.
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user with notes containing the word "architecture"
When they search for "architecture"
Then all their notes containing "architecture" in title or body are returned

Given an authenticated user
When they search for a term that matches no notes
Then an empty result set is displayed with a clear message
```

---

### REQ-011: Per-user data isolation
**Statement:** A user can only view, edit, and delete their own notes and folders. No user can access another user's data through any interface.
**Origin:** Brief -- Domain Invariants (cross-user visibility does not exist), Ground Truths (data should not leak between users)
**Definition of Done:** All data access endpoints enforce ownership. Attempting to access another user's note or folder by any means (direct URL, API call, search) returns no data or an authorization error.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given two users, Alice and Bob, each with their own notes
When Alice requests Bob's note by direct URL or ID
Then the request is denied or returns not found -- Alice sees no data belonging to Bob

Given an authenticated user performing a search
When the search is executed
Then only that user's notes are included in the results, never another user's
```

---

## Non-Functional Requirements

### REQ-012: Data durability
**Statement:** User data (notes, folders, account information) must be persisted durably. The system must protect against data loss from application failures, server restarts, and routine infrastructure events.
**Origin:** Brief -- Ground Truths (data durability is a first-class concern), Manifest -- Infrastructure Preconditions
**Definition of Done:** Data is stored in a persistent database. The architecture includes a backup strategy that is documented and testable. A simulated application restart does not result in data loss.
**Priority:** Must Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given a user who has created notes
When the application server restarts
Then all previously saved notes are intact and accessible after restart

Given the production database
When a backup is executed
Then a restorable backup artifact is produced and its integrity can be verified
```

---

### REQ-013: Responsive web design
**Statement:** The web application must be usable on desktop and mobile browsers without horizontal scrolling or unusable controls.
**Origin:** Brief -- Delivery Channel (web application), Ground Truths (modern web service expectations)
**Definition of Done:** Key pages (login, note list, note editor, note viewer) render correctly on viewports from 375px (mobile) to 1920px (desktop). No horizontal scrollbar appears and all interactive elements are reachable.
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given the note list page
When viewed on a 375px-wide viewport
Then all notes are visible, no horizontal scrollbar appears, and all controls are tappable

Given the note editor page
When viewed on a 1920px-wide viewport
Then the layout uses available space appropriately and is not stretched to unreadable widths
```

---

### REQ-014: Account deletion
**Statement:** A registered user can delete their own account. Deleting an account permanently removes all associated notes, folders, and personal data.
**Origin:** Brief -- Ground Truths (users should be able to delete their own data), Open Question 5
**Definition of Done:** A user can initiate account deletion from their account settings. After confirmation, the account and all associated data are permanently deleted. The user can no longer log in.
**Priority:** Should Have | **Status:** Draft

**Acceptance Scenarios:**
```
Given an authenticated user on their account settings page
When they request account deletion and confirm
Then their account, notes, and folders are permanently deleted and they cannot log in

Given an authenticated user
When they request account deletion but cancel the confirmation
Then no data is deleted and the account remains active
```

---

## Requirements Traceability Summary

| REQ | Traces to Brief section | Priority |
|---|---|---|
| REQ-001 | Stakeholders, Domain Model (User) | Must Have |
| REQ-002 | User Roles (Registered User) | Must Have |
| REQ-003 | Open Question 4, Ground Truths | Should Have |
| REQ-004 | Problem Statement, Scope | Must Have |
| REQ-005 | Scope | Must Have |
| REQ-006 | Scope, Ground Truths | Must Have |
| REQ-007 | Ground Truths (Markdown), Domain Model | Must Have |
| REQ-008 | Scope, Domain Model (Note) | Must Have |
| REQ-009 | Scope, Domain Model (Folder) | Should Have |
| REQ-010 | Scope | Should Have |
| REQ-011 | Domain Invariants, Ground Truths | Must Have |
| REQ-012 | Ground Truths, Manifest | Must Have |
| REQ-013 | Delivery Channel, Ground Truths | Should Have |
| REQ-014 | Ground Truths, Open Question 5 | Should Have |

---

## Handoff Notes for Auditor

**What this version contains:** Initial requirements set derived from Nexus Intake Note via Brief v1. No prior version exists.

**Assumptions made (flagged for Auditor scrutiny):**
- Folder-based organization was assumed as the default (Open Question 1 in Brief). The Nexus has not explicitly confirmed this over alternatives like tags.
- Password reset via email was assumed as a v1 requirement (Open Question 4 in Brief). This introduces an email service dependency.
- Account deletion permanently removes all data (Open Question 5 in Brief). The Nexus has not confirmed whether a grace period or soft-delete is preferred.
- Nested folders are mentioned in the Domain Model but REQ-009 does not require nesting in v1 -- it specifies single-level folders only. Nesting can be added later if the Nexus requests it.

**Requirements the Analyst is uncertain about:**
- REQ-003 (Password reset): This is marked Should Have because it introduces infrastructure complexity (email sending), but for a service users rely on, it may deserve Must Have. The Nexus should weigh in.
- REQ-009 (Folders): The organization model is assumed. If the Nexus prefers tags or a flat list, this requirement changes substantially.
