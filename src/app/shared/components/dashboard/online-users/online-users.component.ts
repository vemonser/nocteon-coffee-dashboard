import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

import { TranslocoPipe } from '@jsverse/transloco';
@Component({
  selector: 'app-online-users',
  standalone: true,
  imports: [CommonModule, HlmBadgeImports, TranslocoPipe,
  ],
  templateUrl: './online-users.component.html',
})
export class OnlineUsersComponent {
  @Input() count: number = 0;
}