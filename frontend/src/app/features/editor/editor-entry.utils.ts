import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Compare two "YYYY-MM" month strings; returns true when a is later than b. */
export function monthAfter(a: string, b: string): boolean {
  return a.localeCompare(b) > 0;
}

/**
 * Group-level validator: end date must not precede start date.
 * Skipped when "currently working here" is set or either date is blank
 * (blank end is allowed for open-ended roles, blank start is left to `required`).
 */
export function endNotBeforeStart(control: AbstractControl): ValidationErrors | null {
  const group = control as { get: (k: string) => AbstractControl | null };
  const current = group.get('current')?.value;
  const start = group.get('startDate')?.value as string;
  const end = group.get('endDate')?.value as string;
  if (current || !start || !end) {
    return null;
  }
  return monthAfter(end, start) ? null : { endBeforeStart: true };
}

/**
 * Group-level validator: expiry date must not precede issue date.
 * Skipped when "does not expire" is set or either date is blank.
 */
export function issueNotAfterExpiry(control: AbstractControl): ValidationErrors | null {
  const group = control as { get: (k: string) => AbstractControl | null };
  const doesNotExpire = group.get('doesNotExpire')?.value;
  const issue = group.get('issueDate')?.value as string;
  const expiry = group.get('expiryDate')?.value as string;
  if (doesNotExpire || !issue || !expiry) {
    return null;
  }
  return monthAfter(expiry, issue) ? null : { expiryBeforeIssue: true };
}

/** Generate a stable-enough id for dynamic entries. */
export function entryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function moveIndex(current: number, delta: number, length: number): number {
  const next = current + delta;
  if (next < 0 || next >= length) {
    return current;
  }
  return next;
}

/** Run a callback after the current change-detection pass has rendered. */
export function afterNextPaint(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
  } else {
    setTimeout(() => callback(), 0);
  }
}
