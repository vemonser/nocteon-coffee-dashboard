// Pages where an unsaved-changes modal is expected when navigating away dirty.
export const dirtyPages: { path: string; fieldSelector: string; value: string }[] = [
  { path: '/dashboard/products/new', fieldSelector: 'input[formControlName="name"]', value: 'QA dirty test' },
  { path: '/dashboard/journal/new', fieldSelector: 'input[formControlName="title"]', value: 'QA dirty test' },
  { path: '/dashboard/profile', fieldSelector: 'input[formControlName="firstName"]', value: 'QA dirty test' },
  { path: '/dashboard/store-settings', fieldSelector: 'input', value: 'QA dirty test' },
];