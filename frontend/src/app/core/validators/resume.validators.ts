import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Basic international phone: digits, spaces, +, -, parentheses. */
export function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string)?.trim();
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, '');
  return /^[+\d][\d\s().-]*$/.test(value) && digits.length >= 7 && digits.length <= 15
    ? null
    : { invalidPhone: true };
}

/** Optional URL field must be a valid http(s) URL when provided. */
export function httpUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string)?.trim();
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? null : { invalidUrl: true };
  } catch {
    return { invalidUrl: true };
  }
}
