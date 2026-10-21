import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { DialogShellComponent } from '../../../../shared/ui/dialog-shell/dialog-shell.component';
import type { OrderShipment } from '../../models/order-activity.model';

export interface ShipmentDraft {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}

/**
 * Record or edit the shipment, in the shared dialog shell.
 *
 * <p>The store records four facts per shipment: the carrier, the tracking
 * number, the tracking URL and the timestamps the backend stamps itself.
 * There is no ETA field in the API, so the form does not ask for one (see
 * API_GAPS.md).
 */
@Component({
  selector: 'app-order-shipment-dialog',
  standalone: true,
  imports: [DialogShellComponent, FormsModule, HlmButtonImports, HlmInputImports, TranslocoPipe],
  templateUrl: './order-shipment-dialog.component.html',
})
export class OrderShipmentDialogComponent {
  private readonly transloco = inject(TranslocoService);

  readonly open = input<boolean>(false);
  readonly orderNumber = input<string>('');
  readonly shipment = input<OrderShipment | null>(null);
  readonly pending = input<boolean>(false);

  readonly saved = output<ShipmentDraft>();
  readonly closed = output<void>();

  protected readonly carrier = signal('');
  protected readonly trackingNumber = signal('');
  protected readonly trackingUrl = signal('');

  /** At least one of carrier/number must be present to record a shipment. */
  protected readonly canSave = signal(false);

  constructor() {
    // The form starts from what the store already has, every time it opens.
    effect(() => {
      if (!this.open()) return;
      const shipment = this.shipment();
      this.carrier.set(shipment?.carrier ?? '');
      this.trackingNumber.set(shipment?.trackingNumber ?? '');
      this.trackingUrl.set(shipment?.trackingUrl ?? '');
      this.updateCanSave();
    });
  }

  protected updateCanSave(): void {
    this.canSave.set(
      this.carrier().trim().length > 0 || this.trackingNumber().trim().length > 0,
    );
  }

  protected save(): void {
    if (!this.canSave() || this.pending()) return;
    this.saved.emit({
      carrier: this.carrier().trim(),
      trackingNumber: this.trackingNumber().trim(),
      trackingUrl: this.trackingUrl().trim(),
    });
  }

  protected title(): string {
    const shipment = this.shipment();
    const exists = !!(
      shipment?.carrier ||
      shipment?.trackingNumber ||
      shipment?.trackingUrl ||
      shipment?.shippedAt ||
      shipment?.deliveredAt
    );
    return this.t(
      exists ? 'orders.detail.editShipment' : 'orders.detail.recordShipment',
      exists ? 'Edit shipment' : 'Record the shipment',
    );
  }

  protected subtitle(): string {
    return this.orderNumber();
  }

  private t(key: string, fallback: string): string {
    // React to a runtime language switch: `translate()` is not a signal read.
    this.transloco.activeLang();
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }
}
