import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { UserAvatarComponent } from './user-avatar.component';

/**
 * The avatar falls back to the initial.
 *
 * The review seed gives every user an EMPTY avatar URL, so the old markup
 * rendered a picture icon that read as a broken image. An initial is never
 * broken.
 */
describe('UserAvatarComponent', () => {
  it('exposes the first letter of the name as the initial', () => {
    // The component uses signal inputs, so it needs an injection context.
    const component = TestBed.runInInjectionContext(() => new UserAvatarComponent());

    expect(component.initial('Ahmed Hassan')).toBe('A');
    expect(component.initial('sara')).toBe('S');
  });

  it('falls back to a neutral letter when the name is empty', () => {
    // The component uses signal inputs, so it needs an injection context.
    const component = TestBed.runInInjectionContext(() => new UserAvatarComponent());

    expect(component.initial('')).toBe('?');
    expect(component.initial(null)).toBe('?');
  });
});
