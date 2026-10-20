import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * The store's own settings — the single source of truth for the store
 * currency.
 *
 * GET /api/settings -> { id, currency: "EGP", freeShippingThreshold, ... }
 *
 * NOTE on the endpoint: the dashboard used to read
 * `GET /api/dashboard/settings`, which answers 405 (the route only accepts
 * PUT). The working read is `GET /api/settings`. This service uses the
 * working one; the 405 is documented in evidence/X6/results.json.
 */
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string;
}

interface StoreSettings {
  id: number;
  currency: string;
  freeShippingThreshold: number;
  isFreeShippingActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private http = inject(HttpClient);
  private settingsUrl = `${environment.apiUrl}/api/settings`;

  private readonly _settings = signal<StoreSettings | null>(null);
  private readonly _error = signal(false);

  readonly settings = this._settings.asReadonly();
  readonly error = this._error.asReadonly();

  /** ISO-4217 code of the store currency. Falls back to USD when unread. */
  readonly currency = computed(() => this._settings()?.currency ?? 'USD');

  private loaded = false;

  constructor() {
    this.load();
  }

  load(): void {
    this.http.get<ApiResponse<StoreSettings>>(this.settingsUrl).subscribe({
      next: (res) => {
        if (res.success && res.data?.currency) {
          this._settings.set(res.data);
          this._error.set(false);
        } else {
          this._error.set(true);
        }
        this.loaded = true;
      },
      error: () => {
        this._error.set(true);
        this.loaded = true;
      },
    });
  }

  retry(): void {
    this.loaded = false;
    this.load();
  }

  get isLoaded(): boolean {
    return this.loaded;
  }
}
