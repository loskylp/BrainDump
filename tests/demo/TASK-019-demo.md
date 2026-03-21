# Demo Script — TASK-019: Account Deletion
**Date:** 2026-03-21
**Environment:** https://braindump.staging.nxlabs.cc
**Prerequisites:** A registered account. All paths are relative to the staging base URL.

---

## Scenario 1 — Settings page is accessible from the workspace

Given   | A logged-in user is on the workspace at `/workspace`
When    | They click the "Account Settings" link in the sidebar footer
Then    | The browser navigates to `/settings` and the Account Settings page appears with a "Danger Zone" section

---

## Scenario 2 — Initiating deletion shows the confirmation UI

Given   | A logged-in user is on the Account Settings page at `/settings`
When    | They click "Delete my account" in the Danger Zone section
Then    | A password input and two buttons appear: "Confirm delete" and "Cancel"
And     | A warning message is visible: "This will permanently delete your account and all your notes. This cannot be undone."

---

## Scenario 3 — Cancelling returns to the idle state without deleting anything

Given   | The user has clicked "Delete my account" and the confirmation UI is visible
When    | They click "Cancel"
Then    | The confirmation UI disappears and only the "Delete my account" button is shown
And     | The account remains active — refreshing `/workspace` still shows notes

---

## Scenario 4 — Wrong password is rejected with an inline error

Given   | The user has clicked "Delete my account" and the password input is visible
When    | They type an incorrect password and click "Confirm delete"
Then    | The server returns 401 and the inline error "Incorrect password" appears below the input
And     | The account is not deleted — the user can still navigate the workspace

---

## Scenario 5 — Correct password permanently deletes the account

Given   | The user has clicked "Delete my account", entered their correct password, and clicked "Confirm delete"
When    | The API call to `DELETE /api/auth/account` succeeds
Then    | The browser navigates to `/login`
And     | Attempting to log in with the deleted credentials returns an error ("Invalid email or password")
And     | The user's notes, note versions, and folders are no longer accessible

---

## Scenario 6 — Session is invalidated immediately after deletion

Given   | The user has deleted their account and been redirected to `/login`
When    | They attempt to navigate directly to `/workspace` (e.g., via the browser back button or URL bar)
Then    | They are redirected back to `/login` because the session is no longer valid

---

## Notes for the Nexus

- The "Account Settings" link appears in the sidebar footer. If the sidebar is collapsed (tablet view), open it with the hamburger toggle first.
- There is no email confirmation step for account deletion — password re-entry is the sole confirmation mechanism.
- The response message from the server is "Account deleted successfully" (visible in the network tab; the frontend does not display it — it navigates immediately).
- Data deletion is permanent and immediate. There is no grace period or undo.
