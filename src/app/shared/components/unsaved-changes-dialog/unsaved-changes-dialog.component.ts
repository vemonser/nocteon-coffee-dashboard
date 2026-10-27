import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { UnsavedChangesDialogService } from '../../../core/services/unsaved-changes-dialog.service';

@Component({
  selector: 'app-unsaved-changes-dialog',
  standalone: true,
  imports: [TranslocoPipe, HlmButtonImports],
  templateUrl: './unsaved-changes-dialog.component.html',
})
export class UnsavedChangesDialogComponent {
  readonly svc = inject(UnsavedChangesDialogService);
}