import { Injectable, signal } from '@angular/core';

export interface UnsavedDialogOptions { canSave: boolean; saving?: boolean; }

@Injectable({ providedIn: 'root' })
export class UnsavedChangesDialogService {
  readonly openState = signal<UnsavedDialogOptions | null>(null);
  private resolver: ((v: 'stay' | 'discard' | 'save') => void) | null = null;

  open(opts: UnsavedDialogOptions): Promise<'stay' | 'discard' | 'save'> {
    this.openState.set(opts);
    return new Promise((resolve) => { this.resolver = resolve; });
  }

  close(result: 'stay' | 'discard' | 'save') {
    this.openState.set(null);
    this.resolver?.(result);
    this.resolver = null;
  }
}