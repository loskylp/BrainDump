/**
 * Unit tests for emailService.sendPasswordResetEmail (TASK-015).
 *
 * Verifies the contract:
 *   - Resolves without throwing in all environments
 *   - Logs the reset URL to stdout (console provider for all envs)
 *   - Does not throw EMAIL_SEND_FAILED on successful log
 */

'use strict';

describe('emailService.sendPasswordResetEmail (TASK-015)', () => {
  let sendPasswordResetEmail;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helper to load the module fresh after resetting modules
  // ---------------------------------------------------------------------------

  function loadService() {
    ({ sendPasswordResetEmail } = require('../../src/services/emailService'));
  }

  // ---------------------------------------------------------------------------
  // Console logging (all environments)
  // ---------------------------------------------------------------------------

  describe('console provider', () => {
    it('resolves without throwing in the test environment', async () => {
      loadService();
      await expect(
        sendPasswordResetEmail('user@example.com', 'http://localhost:5173/reset-password?token=abc123')
      ).resolves.toBeUndefined();
    });

    it('logs the reset URL to console.log', async () => {
      loadService();
      const resetUrl = 'http://localhost:5173/reset-password?token=rawtoken123';
      await sendPasswordResetEmail('user@example.com', resetUrl);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(resetUrl)
      );
    });

    it('logs the recipient email to console.log', async () => {
      loadService();
      await sendPasswordResetEmail('user@example.com', 'http://localhost:5173/reset-password?token=xyz');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('user@example.com')
      );
    });

    it('resolves without throwing in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      loadService();
      await expect(
        sendPasswordResetEmail('prod@example.com', 'https://app.example.com/reset-password?token=tok')
      ).resolves.toBeUndefined();
      process.env.NODE_ENV = originalEnv;
    });
  });
});
