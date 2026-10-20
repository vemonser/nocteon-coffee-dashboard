import { describe, expect, it } from 'vitest';

import {
  STATUS_BADGE_CLASSES,
  STATUS_BADGE_ICONS,
  STATUS_BADGE_LABELS,
  type StatusKind,
} from './status-badge.component';

describe('StatusBadgeComponent', () => {
  it('renders the approved kind as a success', () => {
    expect(STATUS_BADGE_CLASSES['approved']).toBe('bg-success-soft text-success');
    expect(STATUS_BADGE_ICONS['approved']).toBe('lucideCheckCircle');
    expect(STATUS_BADGE_LABELS['approved']).toBe('common.statuses.approved');
  });

  it('gives every kind a label, an icon and a colour', () => {
    for (const kind of Object.keys(STATUS_BADGE_CLASSES) as StatusKind[]) {
      expect(STATUS_BADGE_LABELS[kind]).toBeTruthy();
      expect(STATUS_BADGE_ICONS[kind]).toBeTruthy();
      expect(STATUS_BADGE_CLASSES[kind]).toBeTruthy();
    }
  });
});
