import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  requireText?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly state = signal<ConfirmOptions | null>(null);
  private resolver: ((v: boolean) => void) | null = null;

  confirm(opts: ConfirmOptions): Promise<boolean> {
    this.state.set(opts);
    return new Promise((resolve) => { this.resolver = resolve; });
  }

  resolve(value: boolean) {
    this.state.set(null);
    this.resolver?.(value);
    this.resolver = null;
  }
}