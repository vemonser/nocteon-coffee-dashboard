import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideShoppingBag,
  lucideCreditCard,
  lucideStar,
  lucideMail,
  lucideAlertTriangle,
  lucideUserPlus,
  lucideBell,
  lucideBellOff,
  lucideMoreVertical,
  lucideCheck,
  lucideX,
  lucideTrash2,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import {
  HlmDropdownMenuImports,
} from '@spartan-ng/helm/dropdown-menu';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NotificationItem } from '../models/notification.model';
import { notificationIcon, notificationTint, notificationRoute } from '../notification-type.registry';
import { PermissionService } from '../../../core/auth/permission.service';
import { LanguageService } from '../../../core/i18n/language.service';

@Component({
  selector: 'app-notification-item',
  standalone: true,
  imports: [
    CommonModule,
    NgIcon,
    HlmButtonImports,
    HlmBadgeImports,
    HlmDropdownMenuImports,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideShoppingBag,
      lucideCreditCard,
      lucideStar,
      lucideMail,
      lucideAlertTriangle,
      lucideUserPlus,
      lucideBell,
      lucideBellOff,
      lucideMoreVertical,
      lucideCheck,
      lucideX,
      lucideTrash2,
    }),
  ],
  template: `
    <div
      class="group relative flex items-start gap-3 px-3 py-3 transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
      [class.bg-primary/5]="!item.read"
      [class.bg-accent]="focused"
      role="listitem"
    >
      <button
        type="button"
        class="item-main flex flex-1 items-start gap-3 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
        (click)="onClick()"
      >
        <div class="relative shrink-0">
          @if (item.customerName) {
            <div class="flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
              {{ initials(item.customerName) }}
            </div>
            <span
              class="absolute -bottom-1 -end-1 flex size-4 items-center justify-center rounded-full ring-2 ring-card"
              [class]="tint()"
            >
              <ng-icon [name]="icon()" class="size-2.5" aria-hidden="true" />
            </span>
          } @else {
            <div class="flex size-9 items-center justify-center rounded-full" [class]="tint()">
              <ng-icon [name]="icon()" class="size-4" aria-hidden="true" />
            </div>
          }
        </div>

        <div class="min-w-0 flex-1 pe-7">
          <p class="truncate text-sm font-medium" [class.font-semibold]="!item.read">
            {{ title() }}
          </p>
          <p class="line-clamp-2 text-[13px] text-muted-foreground">
            {{ description() }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground" [attr.title]="absoluteTime()">
            {{ relativeTime() }}
          </p>
        </div>
      </button>

      @if (!item.read) {
        <span
          class="mt-2 size-2 shrink-0 rounded-full bg-primary transition-opacity group-hover:opacity-0 focus-within:opacity-0"
          aria-hidden="true"
        ></span>
      }

      <div class="absolute end-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          hlmBtn
          variant="ghost"
          size="icon"
          class="size-7"
          [attr.aria-label]="'notifications.kebab.more' | transloco"
          [hlmDropdownMenuTrigger]="menu"
        >
          <ng-icon name="lucideMoreVertical" class="size-4" aria-hidden="true" />
        </button>
      </div>

      <ng-template #menu>
        <hlm-dropdown-menu class="w-44">
          @if (!item.read) {
            <button hlmDropdownMenuItem (click)="markRead.emit(item)">
              <ng-icon name="lucideCheck" class="me-2 size-4" />
              {{ 'notifications.kebab.markRead' | transloco }}
            </button>
          } @else {
            <button hlmDropdownMenuItem (click)="markUnread.emit(item)">
              <ng-icon name="lucideX" class="me-2 size-4" />
              {{ 'notifications.kebab.markUnread' | transloco }}
            </button>
          }
          @if (canDelete()) {
            <button hlmDropdownMenuItem class="text-destructive" (click)="delete.emit(item)">
              <ng-icon name="lucideTrash2" class="me-2 size-4" />
              {{ 'notifications.kebab.delete' | transloco }}
            </button>
          }
        </hlm-dropdown-menu>
      </ng-template>
    </div>
  `,
})
export class NotificationItemComponent {
  @Input({ required: true }) item!: NotificationItem;
  @Input() focused = false;
  @Output() clicked = new EventEmitter<NotificationItem>();
  @Output() markRead = new EventEmitter<NotificationItem>();
  @Output() markUnread = new EventEmitter<NotificationItem>();
  @Output() delete = new EventEmitter<NotificationItem>();

  private perm = inject(PermissionService);
  private transloco = inject(TranslocoService);
  private language = inject(LanguageService);

  icon = () => notificationIcon(this.item.type);
  tint = () => notificationTint(this.item.type);

  title = () => {
    if (this.item.titleKey) {
      return this.transloco.translate(this.item.titleKey, this.item.params ?? {});
    }
    return this.item.title || '';
  };

  description = () => {
    if (this.item.bodyKey) {
      return this.transloco.translate(this.item.bodyKey, this.item.params ?? {});
    }
    return this.item.message || '';
  };

  relativeTime(): string {
    const diff = new Date(this.item.createdAt).getTime() - Date.now();
    const abs = Math.abs(diff);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const rtf = new Intl.RelativeTimeFormat(this.language.language(), { numeric: 'auto' });
    if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute');
    if (abs < day) return rtf.format(Math.round(diff / hour), 'hour');
    return rtf.format(Math.round(diff / day), 'day');
  }

  absoluteTime(): string {
    return new Intl.DateTimeFormat(this.language.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(this.item.createdAt));
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  canDelete(): boolean {
    return this.perm.has('notification:delete');
  }

  onClick(): void {
    this.clicked.emit(this.item);
  }
}
