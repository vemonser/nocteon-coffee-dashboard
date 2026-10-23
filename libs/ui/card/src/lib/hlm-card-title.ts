import { Directive } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
  selector: '[hlmCardTitle]',
  host: { 'data-slot': 'card-title' },
})
export class HlmCardTitle {
  constructor() {
    classes(() => 'text-[0.9375rem] leading-snug font-medium tracking-tight group-data-[size=sm]/card:text-sm');
  }
}
