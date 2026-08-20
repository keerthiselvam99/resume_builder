import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { endNotBeforeStart, monthNotInFuture } from './editor-entry.utils';

describe('resume month/year validation', () => {
  const current = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  it('accepts historical years and the current month', () => {
    expect(monthNotInFuture(new FormControl('1950-01'))).toBeNull();
    expect(monthNotInFuture(new FormControl('2001-09'))).toBeNull();
    expect(monthNotInFuture(new FormControl(current()))).toBeNull();
  });

  it('rejects a future month, future year, and years before 1950', () => {
    const now = new Date();
    const future = `${now.getFullYear() + 1}-01`;
    expect(monthNotInFuture(new FormControl(future))).toEqual({ futureMonth: true });
    expect(monthNotInFuture(new FormControl('1949-12'))).toEqual({ futureMonth: true });
  });

  it('rejects end-before-start and accepts equal months', () => {
    const group = (endDate: string) =>
      new FormGroup({
        startDate: new FormControl('2020-06'),
        endDate: new FormControl(endDate),
        current: new FormControl(false),
      });
    expect(endNotBeforeStart(group('2020-05'))).toEqual({ endBeforeStart: true });
    expect(endNotBeforeStart(group('2020-06'))).toBeNull();
  });

  it('ignores the end date for current work', () => {
    const group = new FormGroup({
      startDate: new FormControl('2020-06'),
      endDate: new FormControl('2019-01'),
      current: new FormControl(true),
    });
    expect(endNotBeforeStart(group)).toBeNull();
  });
});
