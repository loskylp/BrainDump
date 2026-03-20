/**
 * Jest configuration for the BrainDump backend.
 */

'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
  ],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
