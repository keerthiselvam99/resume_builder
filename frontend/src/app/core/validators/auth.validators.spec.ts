import { FormControl, FormGroup } from '@angular/forms';
import { emailValidator, passwordStrengthValidator, matchValues } from './auth.validators';

describe('emailValidator', () => {
  it('allows a valid email', () => {
    expect(emailValidator(new FormControl('arun@example.com'))).toBeNull();
  });

  it('flags an invalid email', () => {
    expect(emailValidator(new FormControl('not-an-email'))).toEqual({ invalidEmail: true });
  });

  it('returns null for empty value (required handles that)', () => {
    expect(emailValidator(new FormControl(''))).toBeNull();
  });
});

describe('passwordStrengthValidator', () => {
  it('accepts a strong password', () => {
    expect(passwordStrengthValidator(new FormControl('StrongPass1'))).toBeNull();
  });

  it('rejects a short password', () => {
    const result = passwordStrengthValidator(new FormControl('Ab1')) as Record<string, unknown>;
    expect(result?.['weakPassword']).toBeTruthy();
  });

  it('rejects a password without letters', () => {
    const result = passwordStrengthValidator(new FormControl('12345678')) as Record<
      string,
      unknown
    >;
    expect(result?.['weakPassword']).toBeTruthy();
  });

  it('rejects a password without numbers', () => {
    const result = passwordStrengthValidator(new FormControl('onlyletters')) as Record<
      string,
      unknown
    >;
    expect(result?.['weakPassword']).toBeTruthy();
  });
});

describe('matchValues', () => {
  function build(passOne: string, passTwo: string): FormGroup {
    const group = new FormGroup({
      password: new FormControl(passOne),
      confirmPassword: new FormControl(passTwo, [matchValues('password')]),
    });
    group.controls['confirmPassword'].updateValueAndValidity();
    return group;
  }

  it('returns null when values match', () => {
    const group = build('abc12345', 'abc12345');
    expect(group.controls['confirmPassword'].errors).toBeNull();
  });

  it('flags a mismatch', () => {
    const group = build('abc12345', 'different');
    expect(group.controls['confirmPassword'].errors).toEqual({ mismatch: true });
  });
});
