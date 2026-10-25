import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DirtyRegistry } from './core/services/dirty-registry.service';
import { UnsavedChangesDialogComponent } from './shared/components/unsaved-changes-dialog/unsaved-changes-dialog.component';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UnsavedChangesDialogComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private dirty = inject(DirtyRegistry);
  ngOnInit() {
    window.addEventListener('beforeunload', (e) => {
      if (this.dirty.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }
}
