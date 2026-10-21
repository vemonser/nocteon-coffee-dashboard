import { Directive } from '@angular/core';
import { BrnFieldControlDescribedBy } from '@spartan-ng/brain/field';
import { BrnInput } from '@spartan-ng/brain/input';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
  selector: '[hlmInput]',
  hostDirectives: [
    { directive: BrnInput, inputs: ['id', 'forceInvalid'] },
    BrnFieldControlDescribedBy,
  ],
  host: { 'data-slot': 'input' },
})
export class HlmInput {
  constructor() {
    // `[&:not(textarea)]:h-…` — the fixed control height is for single-line
    // inputs. Templates that put `hlmInput` on a `<textarea>` (the legacy
    // pattern; `hlmTextarea` is the correct directive) must keep sizing from
    // `rows` and their own vertical padding, otherwise the box collapses to a
    // 40px single-line control.
    classes(
      () =>
        'border-input focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 disabled:bg-muted [&:not(textarea)]:h-[var(--control-height)] rounded-[var(--radius-control)] border bg-transparent px-2.5 py-2 text-[length:var(--control-font-size-mobile)] leading-[var(--control-line-height-mobile)] md:text-[length:var(--control-font-size)] md:leading-[var(--control-line-height)] transition-colors file:h-6 file:text-[length:var(--control-font-size-mobile)] md:file:text-[length:var(--control-font-size)] file:font-medium focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    );
  }
}
