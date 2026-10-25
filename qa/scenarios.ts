// Scripted steps for dialogs/popovers exercised by the QA harness.
export type Step = { action: string; selector?: string; value?: string };

export const scenarios: Record<string, Step[]> = {
  'add-user': [
    { action: 'click', selector: 'button:has-text("Add user"), button:has-text("New user")' },
    { action: 'wait', selector: '[role="dialog"]' },
    { action: 'close', selector: '[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has-text("Cancel")' },
  ],
  'edit-user': [{ action: 'click', selector: 'table tbody tr:first-child button[aria-label*="Edit"], table tbody tr:first-child .kebab' }],
  'change-role': [{ action: 'click', selector: 'button:has-text("Change role")' }],
  'add-option': [{ action: 'click', selector: 'button:has-text("Add option"), button:has-text("New option")' }],
  'add-value-popover': [{ action: 'click', selector: 'button:has-text("Add value")' }],
  'review-details': [{ action: 'click', selector: 'table tbody tr:first-child' }],
  'contact-message': [{ action: 'click', selector: 'table tbody tr:first-child' }],
  'cart-modal': [{ action: 'click', selector: 'table tbody tr:first-child' }],
  'notifications-popover': [{ action: 'click', selector: 'button[aria-label*="notification"], button:has-text("Notifications")' }],
  'search-palette': [{ action: 'keydown', value: 'Control+K' }],
  'confirm-dialog': [{ action: 'click', selector: 'button:has-text("Delete")' }],
};