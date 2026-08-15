import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactInfo } from '../../core/models/resume.model';
import { AppInput } from '../../shared/components/app-input.component';
import { phoneValidator, httpUrlValidator } from '../../core/validators/resume.validators';
import { emailValidator } from '../../core/validators/auth.validators';

@Component({
  selector: 'app-editor-contact-form',
  template: `
    <form [formGroup]="form" class="section" novalidate>
      <h2 class="section__title">Contact</h2>
      <div class="grid">
        <app-input
          label="Full name"
          [error]="errorFor(form.controls.fullName)"
          formControlName="fullName"
          autocomplete="name"
        />
        <app-input
          label="Job title / Headline"
          [error]="errorFor(form.controls.title)"
          formControlName="title"
          placeholder="e.g., Senior Software Engineer"
        />
        <app-input
          label="Email"
          type="email"
          [error]="errorFor(form.controls.email)"
          formControlName="email"
          autocomplete="email"
        />
        <app-input
          label="Phone"
          [error]="errorFor(form.controls.phone)"
          formControlName="phone"
          autocomplete="tel"
        />
        <app-input
          label="Location"
          [error]="errorFor(form.controls.location)"
          formControlName="location"
        />
        <app-input
          label="LinkedIn URL"
          [error]="errorFor(form.controls.linkedinUrl)"
          formControlName="linkedinUrl"
          placeholder="https://linkedin.com/in/..."
        />
        <app-input
          label="GitHub URL"
          [error]="errorFor(form.controls.githubUrl)"
          formControlName="githubUrl"
          placeholder="https://github.com/..."
        />
        <app-input
          label="Portfolio URL"
          [error]="errorFor(form.controls.portfolioUrl)"
          formControlName="portfolioUrl"
          placeholder="https://..."
        />
      </div>
    </form>
  `,
  styles: `
    .section {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
    }
    .section__title {
      font-size: var(--fs-md);
      margin: 0 0 var(--space-4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }
    @media (max-width: 720px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppInput],
})
export class EditorContactFormComponent {
  readonly contacts = input<ContactInfo | null>(null);
  readonly contactsChange = output<ContactInfo>();

  readonly form = new FormGroup({
    fullName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    title: new FormControl('', [Validators.maxLength(100)]),
    email: new FormControl('', [Validators.required, emailValidator]),
    phone: new FormControl('', [phoneValidator]),
    location: new FormControl('', [Validators.maxLength(100)]),
    linkedinUrl: new FormControl('', [httpUrlValidator]),
    githubUrl: new FormControl('', [httpUrlValidator]),
    portfolioUrl: new FormControl('', [httpUrlValidator]),
  });

  constructor() {
    effect(() => {
      const value = this.contacts();
      if (value && JSON.stringify(value) !== JSON.stringify(this.form.getRawValue())) {
        this.form.patchValue(value, { emitEvent: false });
      }
    });
    this.form.valueChanges.subscribe((value) => {
      this.contactsChange.emit(value as ContactInfo);
    });
  }

  errorFor(control: FormControl): string | null {
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('maxlength')) {
      const max = control.errors?.['maxlength']?.requiredLength ?? 100;
      return `Keep it under ${max} characters.`;
    }
    if (control.hasError('invalidEmail')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('invalidPhone')) {
      return 'Enter a valid phone number.';
    }
    if (control.hasError('invalidUrl')) {
      return 'Enter a valid http(s) URL.';
    }
    return null;
  }
}
