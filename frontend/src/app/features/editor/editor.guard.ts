import { CanDeactivateFn } from '@angular/router';

interface CanDeactivateHost {
  canDeactivate(): boolean | Promise<boolean>;
}

/**
 * Navigation protection for the editor route. Delegates to the component's
 * canDeactivate hook, which flushes pending debounced edits, waits for any
 * in-flight save, and lets the user retry/remain/leave when saving fails.
 */
export const canDeactivateEditor: CanDeactivateFn<unknown> = (component) => {
  const host = component as CanDeactivateHost | null;
  return typeof host?.canDeactivate === 'function' ? host.canDeactivate() : true;
};
