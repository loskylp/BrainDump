/**
 * TASK-003 -- RegisterForm Component Tests
 *
 * Tests AC-6: Registration form validates inputs client-side before submission
 * Also tests API error handling for AC-3 (duplicate email) at the UI level.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '../components/auth/RegisterForm.jsx';

// Mock the auth API module
vi.mock('../api/auth.js', () => ({
  register: vi.fn(),
}));

import { register as registerApi } from '../api/auth.js';

describe('RegisterForm', () => {
  let onSuccess;
  let user;

  beforeEach(() => {
    onSuccess = vi.fn();
    registerApi.mockReset();
    user = userEvent.setup();
  });

  it('renders username, email, and password fields', () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  // AC-6: Client-side validation -- empty username
  it('shows error when username is empty on submit', async () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
    expect(registerApi).not.toHaveBeenCalled();
  });

  // AC-6: Client-side validation -- empty email
  it('shows error when email is empty on submit', async () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(registerApi).not.toHaveBeenCalled();
  });

  // AC-6: Client-side validation -- invalid email format
  it('shows error for invalid email format', async () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(registerApi).not.toHaveBeenCalled();
  });

  // AC-6: Client-side validation -- password too short
  it('shows error when password is less than 8 characters', async () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(registerApi).not.toHaveBeenCalled();
  });

  // AC-6: Client-side validation -- empty password
  it('shows error when password is empty', async () => {
    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(registerApi).not.toHaveBeenCalled();
  });

  // Successful submission
  it('calls onSuccess with user data on successful registration', async () => {
    const mockUser = { id: 'uuid-123', username: 'testuser', email: 'test@example.com' };
    registerApi.mockResolvedValueOnce({ user: mockUser });

    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockUser);
    });
  });

  it('calls the register API with trimmed values', async () => {
    registerApi.mockResolvedValueOnce({
      user: { id: 'uuid-123', username: 'testuser', email: 'test@example.com' },
    });

    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), '  testuser  ');
    await user.type(screen.getByLabelText(/email/i), '  test@example.com  ');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(registerApi).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  // AC-3 (UI level): Duplicate email error display
  it('shows duplicate email error message on 409 response', async () => {
    const apiError = new Error('EMAIL_TAKEN');
    apiError.status = 409;
    apiError.error = 'EMAIL_TAKEN';
    registerApi.mockRejectedValueOnce(apiError);

    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/an account with this email already exists/i)
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // Shows loading state during submission
  it('shows loading text on the button while submitting', async () => {
    let resolveRegister;
    registerApi.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRegister = resolve; })
    );

    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('button', { name: /creating account/i })).toBeInTheDocument();

    // Resolve to clean up
    resolveRegister({ user: { id: '1', username: 'testuser', email: 'test@example.com' } });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // Handles generic server error
  it('shows generic error message on unexpected server error', async () => {
    const apiError = new Error('Internal Server Error');
    apiError.status = 500;
    registerApi.mockRejectedValueOnce(apiError);

    render(<RegisterForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
