import { Directive, ElementRef, HostListener, Output, EventEmitter, inject } from '@angular/core';

/**
 * Emits `appClickOutside` when a click lands outside the host element, and
 * also closes on Escape (so the host does not need its own keydown handler).
 *
 * Used by the "column visibility" popovers across every list: before this
 * the popover only closed on re-clicking its own button, which felt broken
 * (UX_AUDIT_products.md #8 adjacent friction, reported live).
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  @Output() appClickOutside = new EventEmitter<void>();

  private readonly host = inject(ElementRef<HTMLElement>);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.appClickOutside.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.appClickOutside.emit();
  }
}
