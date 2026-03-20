/**
 * LoginForm component.
 *
 * Controlled form component for the login page. Handles client-side
 * validation before submission and delegates to the auth API.
 *
 * Visual spec (ADR-008):
 *   - Labels: 14px, text-primary, font-weight 600
 *   - Inputs: border (#DEE2E6), bg-primary, text-primary, 8px padding
 *   - Submit button: accent (#0D6EFD) background, white text
 *   - Error message: error (#DC3545) color
 *   - No rounded corners > 4px
 */

// TODO: TASK-004
import React, { useState } from 'react';

/**
 * @param {object} props
 * @param {function} props.onSuccess - Callback invoked with the user object after successful login
 * @param {function} props.onForgotPassword - Callback invoked when user clicks "Forgot password?"
 * @returns {JSX.Element}
 *
 * @postcondition On submission with empty fields: client-side error is shown, no API call made
 * @postcondition On 401 response: "Invalid email or password" error shown
 * @postcondition On success: props.onSuccess({ id, username, email }) is called
 */
function LoginForm({ onSuccess, onForgotPassword }) {
  // TODO: TASK-004 -- implement form state, validation, and API call
  return null;
}

export default LoginForm;
