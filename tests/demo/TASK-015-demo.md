# Demo Script — TASK-015: Password Reset Flow

**Task:** TASK-015
**Requirement:** REQ-015 — Password reset via email link (forgot-password form → console email on staging → reset form)
**Environment:** Staging — https://braindump.staging.nxlabs.cc
**Date:** 2026-03-21
**Prerequisites:** A registered account. Staging uses `EMAIL_PROVIDER=console`, so reset emails are written to the server console log rather than delivered to an inbox. The demo covers form submission and the success message; clicking an actual reset link is not part of the staging validation (the link exists in the server logs and can be retrieved there by a developer if needed).

---

## Scenario 1 — Forgot password page is reachable from the login page (AC-1)

Given   | A visitor on the login page at `/login`
When    | The visitor clicks "Forgot password?" (or equivalent link)
Then    | The browser navigates to `/forgot-password`
        | A form with a single email input and a submit button is visible

Screenshot: `01-forgot-password-form.png`

---

## Scenario 2 — Submitting a registered email shows the success message (AC-2)

Given   | A visitor on `/forgot-password` with a registered email address
When    | The visitor enters the registered email and submits the form
Then    | The form is replaced (or the area below the button shows) the message:
          "If an account with that email exists, a password reset link has been sent."
        | No account enumeration information is disclosed (same message for any email)

Screenshot: `02-forgot-password-success.png`

Note    | On staging, no email is actually delivered. The reset token and link are written
          to the backend console log (`EMAIL_PROVIDER=console`). A developer can retrieve
          the link from server logs to complete the flow end-to-end.

---

## Scenario 3 — Submitting an unregistered email returns the same success message (AC-2, AC-7)

Given   | A visitor on `/forgot-password` with an email not registered in the system
When    | The visitor enters the unknown email and submits the form
Then    | The response is identical to Scenario 2: "If an account with that email exists…"
        | The response time is similar to the registered-email case (no timing oracle)

---

## Scenario 4 — Reset password form validates the new password (AC-4, AC-5)

Given   | A developer who has retrieved a valid reset token from the server console log
          and navigated to `/reset-password?token=<token>`
When    | The developer loads the page
Then    | A form appears with two inputs: "New password" and "Confirm password"
        | A submit button is visible

When    | The developer enters a password shorter than the minimum length and submits
Then    | An inline validation error appears (e.g. "Password must be at least 8 characters")
        | The form is not submitted

When    | The developer enters mismatched values in the two fields and submits
Then    | An inline validation error appears (e.g. "Passwords do not match")

Screenshot: `03-reset-password-form.png`

---

## Scenario 5 — Successful password reset allows login with the new password (AC-3, AC-6)

Given   | A developer who has completed the reset form with a valid token and a new password
When    | The form is submitted successfully
Then    | The browser navigates to `/login` (or a success page with a link to login)
        | The user can log in with the new password
        | Attempting to log in with the old password fails with "Invalid email or password"
        | The reset token is consumed — a second submission with the same token returns an error

Note    | This scenario is verified manually by a developer using the console-logged token.
          It is not exercised in the automated Playwright pass because there is no email inbox.

---

## Scenario 6 — Expired or invalid token shows an error (AC-5)

Given   | A visitor who navigates to `/reset-password?token=invalidtoken`
When    | The page loads and the visitor attempts to submit a new password
Then    | The server returns an error and the UI displays a message such as
          "This link is invalid or has expired. Please request a new password reset."

Screenshot: `04-invalid-token-error.png`

---

## Notes for the Nexus

- `EMAIL_PROVIDER=console` is the staging configuration. No SMTP credentials are required for the staging deployment.
- The reset token is a cryptographically random value with a 1-hour TTL stored in the database.
- There is no rate limit on `/api/auth/forgot-password` beyond the global auth rate limiter (TASK-024: 10 req / 15 min per IP).
- The reset link format is: `https://braindump.staging.nxlabs.cc/reset-password?token=<token>`
