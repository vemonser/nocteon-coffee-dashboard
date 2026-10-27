import { CanDeactivateFn } from '@angular/router';
export interface CanComponentDeactivate { canDeactivate: () => boolean | Promise<boolean> | import('rxjs').Observable<boolean>; }
import { inject } from '@angular/core';
import { HasUnsavedChanges } from './has-unsaved-changes';
import { UnsavedChangesDialogService } from '../services/unsaved-changes-dialog.service';

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  if (!component || typeof component.isDirty !== 'function') return true;
  if (!component.isDirty()) return true;

  const dialog = inject(UnsavedChangesDialogService);
  const canSave = typeof component.saveAll === 'function';
  const res = await dialog.open({ canSave });
  if (res === 'stay') return false;
  if (res === 'discard') return true;
  if (res === 'save') {
    if (!component.saveAll) return true;
    const r = await component.saveAll();
    if (r.ok) return true;
    // validation error: switch tab
    if (r.firstInvalidTab) {
      // component may handle tab switching; best-effort
      (component as any).activeTab?.set?.(r.firstInvalidTab);
    }
    return false;
  }
  return false;
};