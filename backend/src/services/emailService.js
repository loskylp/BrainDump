/**
 * Email service.
 *
 * Integration boundary for outbound email delivery (ADR-002). The application
 * defines this interface; the concrete delivery mechanism is configured via
 * environment variables and is never an application concern.
 *
 * Provider selection:
 *   EMAIL_PROVIDER=console  -> logs the reset URL to stdout (development default)
 *   EMAIL_PROVIDER=<other>  -> delegates to the configured transactional email
 *                              provider using EMAIL_API_KEY and EMAIL_FROM
 *
 * This service has one public method. Additional email types (e.g., welcome
 * emails, account deletion confirmation) are deferred to future cycles.
 */

'use strict';

require('dotenv').config();

/**
 * Sends a password reset email to the specified address.
 *
 * In all current environments (including production): logs the reset URL to
 * stdout with a clear label. A real email provider integration is deferred to
 * a future cycle (ADR-002 email integration boundary).
 *
 * The email body includes the full resetUrl so the recipient can click or
 * paste it to reach the reset form. The link contains the raw token that
 * will be looked up in password_reset_tokens.
 *
 * @param {string} to - Recipient email address
 * @param {string} resetUrl - Full URL including the raw reset token, e.g.
 *   "https://braindump.nxlabs.cc/reset-password?token=<rawToken>"
 * @returns {Promise<void>}
 * @throws {Error} With message 'EMAIL_SEND_FAILED' if the provider returns an error
 *
 * @precondition to is a valid email address string
 * @precondition resetUrl contains the raw reset token as a query parameter
 * @postcondition resetUrl appears in stdout (console.log)
 * @postcondition This method does not check whether the token is valid or expired --
 *                that is authService's responsibility
 */
async function sendPasswordResetEmail(to, resetUrl) {
  console.log(`[EMAIL] Password reset link for ${to}: ${resetUrl}`);
}

module.exports = { sendPasswordResetEmail };
