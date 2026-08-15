import { ElementRef } from '@angular/core';

/**
 * Resolve the underlying native element from a signal query result. Angular's
 * `viewChild` returns an `ElementRef` for template reference variables, so call
 * sites must unwrap it before using DOM APIs.
 */
export function toNativeElement(ref: unknown): HTMLElement | null {
  if (!ref) {
    return null;
  }
  if (ref instanceof HTMLElement) {
    return ref;
  }
  if (ref instanceof ElementRef && ref.nativeElement instanceof HTMLElement) {
    return ref.nativeElement;
  }
  return null;
}
