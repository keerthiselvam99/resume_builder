import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Compare two "YYYY-MM" month strings; returns true when a is later than b. */
export function monthAfter(a: string, b: string): boolean {
  return a.localeCompare(b) > 0;
}

export function monthNotInFuture(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  if (!value) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { monthYear: true };
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return value > current || Number(value.slice(0, 4)) < 1950 ? { futureMonth: true } : null;
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
  return end.localeCompare(start) >= 0 ? null : { endBeforeStart: true };
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
  return expiry.localeCompare(issue) >= 0 ? null : { expiryBeforeIssue: true };
}

export function monthError(
  control: AbstractControl,
  kind: 'start' | 'end' | 'date',
): string | null {
  if (!control.touched || !control.errors) return null;
  if (control.errors['required'] || control.errors['monthYear']) return 'Choose a month and year.';
  if (control.errors['futureMonth']) {
    return kind === 'start'
      ? 'Start date cannot be in the future.'
      : kind === 'end'
        ? 'End date cannot be in the future.'
        : 'Date cannot be in the future.';
  }
  return null;
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
