import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppInput } from './app-input.component';
import { AppPasswordInput } from './app-password-input.component';

@Component({
  standalone: true,
  template: `
    <app-input id="fixture-input" label="Name" [error]="error()" [formControl]="control" />
    <app-password-input id="fixture-pw" label="Password" [formControl]="pw" />
  `,
  imports: [ReactiveFormsModule, AppInput, AppPasswordInput],
})
class TestHost {
  control = new FormControl('');
  pw = new FormControl('');
  error = signal<string | null>(null);
}

describe('AppInput (ControlValueAccessor)', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let input: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector(
      'app-input input',
    ) as HTMLInputElement;
  });

  it('renders the control value', () => {
    host.control.setValue('Arun');
    fixture.detectChanges();
    expect(input.value).toBe('Arun');
  });

  it('propagates user input to the form control', () => {
    input.value = 'Keerthi';
    input.dispatchEvent(new Event('input'));
    expect(host.control.value).toBe('Keerthi');
  });

  it('marks the control touched on blur', () => {
    expect(host.control.touched).toBe(false);
    input.dispatchEvent(new Event('blur'));
    expect(host.control.touched).toBe(true);
  });

  it('shows an error message when the error input is set', () => {
    host.error.set('This field is required.');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('This field is required.');
  });

  it('does not render an error element when error is null', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('This field is required.');
  });

  it('respects the disabled state via setDisabledState', () => {
    host.control.disable();
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });
});

describe('AppPasswordInput', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let pw: HTMLInputElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    pw = (fixture.nativeElement as HTMLElement).querySelector(
      'app-password-input input',
    ) as HTMLInputElement;
  });

  it('is masked by default', () => {
    expect(pw.type).toBe('password');
  });

  it('toggles visibility when the show button is clicked', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'app-password-input button',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(pw.type).toBe('text');
  });

  it('propagates user input to the form control', () => {
    pw.value = 'secret123';
    pw.dispatchEvent(new Event('input'));
    expect(host.pw.value).toBe('secret123');
  });

  it('marks the control touched on blur', () => {
    pw.dispatchEvent(new Event('blur'));
    expect(host.pw.touched).toBe(true);
  });
});
