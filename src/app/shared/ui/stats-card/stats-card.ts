import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { AppCard } from '../card/card';
@Component({
  selector: 'app-stats-card',
  imports: [ NgIcon],
  templateUrl: './stats-card.html',
  styleUrl: './stats-card.css',
})
export class StatsCard {
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly growth = input<string>();
  readonly icon = input.required<string>();
}
