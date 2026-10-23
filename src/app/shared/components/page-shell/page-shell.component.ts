import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-shell',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="page-shell"><ng-content></ng-content></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class PageShellComponent {}