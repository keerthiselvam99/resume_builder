import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) {
    return null; // required handled separately
  }
  return EMAIL_PATTERN.test(value) ? null : { invalidEmail: true };
}

/** Minimum 8 chars, at least one letter and one number. */
export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value) {
    return null;
  }
  const errors: Record<string, boolean> = {};
  if (value.length < 8) {
    errors['minLength'] = true;
  }
  if (!/[A-Za-z]/.test(value)) {
    errors['missingLetter'] = true;
  }
  if (!/\d/.test(value)) {
    errors['missingNumber'] = true;
  }
  return Object.keys(errors).length > 0 ? { weakPassword: errors } : null;
}

export function matchValues(compareTo: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const root = control.root;
    if (!root) {
      return null;
    }
    const other = root.get(compareTo);
    if (!other) {
      return null;
    }
    return control.value === other.value ? null : { mismatch: true };
  };
}
