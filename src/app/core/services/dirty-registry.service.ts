import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DirtyRegistry {
  private readonly entries = signal<Map<string, boolean>>(new Map());

  register(label: string, dirty: boolean) {
    const m = new Map(this.entries());
    m.set(label, dirty);
    this.entries.set(m);
  }

  unregister(label: string) {
    const m = new Map(this.entries());
    m.delete(label);
    this.entries.set(m);
  }

  isDirty(): boolean {
    for (const v of this.entries().values()) if (v) return true;
    return false;
  }

  labels(): string[] { return [...this.entries().keys()]; }
}