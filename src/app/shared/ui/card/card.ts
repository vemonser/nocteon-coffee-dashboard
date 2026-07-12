import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-card',
  imports: [NgClass],
  templateUrl: './card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,

  styleUrl: './card.css',
})
export class AppCard  {
  readonly variant = input<'default' | 'glass'>('default');
  protected readonly defaultClasses = 'bg-card border-border shadow-sm';
  protected readonly glassClasses = 'bg-card/60 backdrop-blur-xl border-border/50 shadow-2xl';
}
