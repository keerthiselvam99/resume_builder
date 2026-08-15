import { config } from '../../config/config';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationIssue {
  field: string;
  message: string;
}

export function validateName(name: unknown): ValidationIssue | null {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { field: 'name', message: 'Name is required.' };
  }
  if (name.trim().length > 200) {
    return { field: 'name', message: 'Name must be at most 200 characters.' };
  }
  return null;
}

export function validateEmail(email: unknown): ValidationIssue | null {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return { field: 'email', message: 'Email is required.' };
  }
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return { field: 'email', message: 'Enter a valid email address.' };
  }
  return null;
}

/**
 * Mirrors the frontend password rule: at least 8 characters with at least one
 * letter and one number. Also caps length to keep the KDF bounded.
 */
export function validatePassword(password: unknown): ValidationIssue | null {
  if (typeof password !== 'string' || password.length === 0) {
    return { field: 'password', message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { field: 'password', message: 'Password must be at least 8 characters.' };
  }
  if (password.length > config.auth.passwordMaxLength) {
    return { field: 'password', message: 'Password is too long.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one letter.' };
  }
  if (!/\d/.test(password)) {
    return { field: 'password', message: 'Password must contain at least one number.' };
  }
  return null;
}
