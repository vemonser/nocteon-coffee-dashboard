import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['qa/finder/test/**/*.spec.ts'],
    reporters: ['default'],
  },
});
