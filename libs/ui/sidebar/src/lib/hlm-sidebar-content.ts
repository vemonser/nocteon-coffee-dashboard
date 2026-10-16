import { Directive } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
  selector: '[hlmSidebarContent],hlm-sidebar-content',
  host: {
    'data-slot': 'sidebar-content',
    'data-sidebar': 'content',
  },
})
export class HlmSidebarContent {
  constructor() {
    classes(
      () =>
        // Deliberately no `no-scrollbar`: when the nav is taller than the viewport it scrolls,
        // and hiding the scrollbar left no cue that the active item was below the fold.
        'gap-0 flex min-h-0 flex-1 flex-col overflow-y-auto group-data-[collapsible=icon]:overflow-hidden',
    );
  }
}
