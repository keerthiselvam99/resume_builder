import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthYearPickerComponent } from './month-year-picker.component';

describe('MonthYearPickerComponent', () => {
  let fixture: ComponentFixture<MonthYearPickerComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthYearPickerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MonthYearPickerComponent);
    fixture.componentRef.setInput('label', 'Start date');
    fixture.detectChanges();
  });

  it('offers an obvious historical year selector through the current year', () => {
    const years = Array.from(
      fixture.nativeElement.querySelectorAll('select[aria-label="Start date year"] option'),
    ).map((option) => (option as HTMLOptionElement).value);
    expect(years).toContain('1950');
    expect(years).toContain(String(new Date().getFullYear()));
  });

  it('has keyboard-operable selects with accessible names', () => {
    const month = fixture.nativeElement.querySelector('select[aria-label="Start date month"]');
    const year = fixture.nativeElement.querySelector('select[aria-label="Start date year"]');
    expect(month).toBeTruthy();
    expect(year).toBeTruthy();
  });

  it('associates an inline error with both selects', () => {
    fixture.componentRef.setInput('error', 'Start date cannot be in the future.');
    fixture.detectChanges();
    const selects = fixture.nativeElement.querySelectorAll('select');
    const error = fixture.nativeElement.querySelector('[role="alert"]');
    expect(error.id).toBeTruthy();
    for (const select of selects) {
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(select.getAttribute('aria-describedby')).toBe(error.id);
    }
  });

  it('disables future months when the current year is selected', () => {
    fixture.componentInstance.writeValue(`${new Date().getFullYear()}-01`);
    fixture.detectChanges();
    const futureMonth = new Date().getMonth() + 2;
    if (futureMonth <= 12) expect(fixture.componentInstance.monthDisabled(futureMonth)).toBe(true);
  });
});
