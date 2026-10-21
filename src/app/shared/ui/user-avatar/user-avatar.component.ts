import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * The avatar: the picture when there is one, the initial when there is not.
 *
 * The seed gives every user an EMPTY avatar URL, and the old markup rendered
 * a picture icon for it — which reads as a broken image rather than as a
 * person. An initial is never broken, and it matches how the dashboard
 * renders the recent-orders avatars.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (src()) {
      <img
        [src]="src()"
        [alt]="name()"
        [class]="sizeClass() + ' rounded-full object-cover'"
      />
    } @else {
      <span
        [class]="
          sizeClass() +
          ' flex items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary'
        "
        [attr.aria-label]="name()"
        >{{ initial(name()) }}</span
      >
    }
  `,
})
export class UserAvatarComponent {
  readonly src = input<string | null>(null);
  readonly name = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly sizeClass = computed(() =>
    this.size() === 'sm' ? 'size-6' : 'size-8',
  );

  /** The first letter, uppercased. Never empty — a blank name is a '?'. */
  initial(name: string | null | undefined): string {
    const first = (name ?? '').trim().charAt(0);
    return first ? first.toUpperCase() : '?';
  }
}
