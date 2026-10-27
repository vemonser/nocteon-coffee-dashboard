---
last_mapped_commit: 2c5b82b097aec293aee8a62c7d6ea81070ac203e
last_mapped_at: 2026-10-26
---
<!-- refreshed: 2026-10-26 -->

# Technology Stack

**Analysis Date:** 2026-10-26

## Languages & Runtime

- **Language:** TypeScript `~6.0.2`
- **Runtime:** Browser SPA (Angular 22). Development server via Angular CLI; no Node runtime in production bundle.
- **Package manager:** npm `11.16.0` (declared in `package.json`).
- **Module format:** ESM; Angular application builder (`@angular/build:application`).

## Frameworks

- **Angular:** `^22.0.0` (core, common, compiler, forms, router, platform-browser).
- **Angular CDK / Material:** `^22.0.2` (CDK + Material).
- **RxJS:** `~7.8.0`.
- **Tailwind CSS:** `^4.1.12` with `@tailwindcss/postcss`.
- **Transloco:** `@jsverse/transloco ^8.4.0` (i18n).
- **ApexCharts / ng-apexcharts:** `apexcharts ^5.15.2`, `ng-apexcharts ^2.4.0`.
- **Quill / ngx-quill:** `quill ^2.0.3`, `ngx-quill ^31.0.1`.
- **Embla Carousel:** `embla-carousel >=8.0.0 <9.0.0`, `embla-carousel-angular ^22.0.0`.
- **GSAP:** `^3.15.0`.
- **ngx-scrollbar:** `^19.1.5`.
- **@ng-icons:** `core ^33.3.0` plus heroicons/lucide/material-file-icons/material-symbols `^33.4.0`.
- **@tanstack/angular-table:** `^8.21.4`.
- **@spartan-ng/brain:** `^1.0.4` (headless primitives).
- **class-variance-authority / clsx / tailwind-merge:** styling utilities.

## Styling

- **Tailwind CSS 4** via PostCSS (`postcss.config` in `.postcssrc.json`).
- **Component styles:** Angular component CSS/SCSS plus Tailwind utility classes.
- **Theme tokens:** defined in `src/styles` and `tailwind.config.js`; dark mode via `.dark` class on `<html>`.
- **Animation:** Angular animations (`src/app/core/animations`) + GSAP.

## UI Primitives

- **Spartan Helm** components vendored under `libs/ui/*` and consumed through `@spartan-ng/helm/*` path aliases (see `tsconfig.json`).
- **Custom status badge** exposed as `@nocteon/status-badge` → `src/app/shared/ui/status-badge`.

## Build & Tooling

- **Angular CLI:** `@angular/cli ^22.0.0`.
- **TypeScript:** `~6.0.2`.
- **Unit tests:** Angular builder `@angular/build:unit-test` (Vitest `^4.0.8` available).
- **E2E tests:** Playwright `^1.64.0`.
- **Formatting:** Prettier `^3.8.1` (`.prettierrc`, printWidth 100, single quotes, Angular HTML parser).
- **Editor config:** `.editorconfig` (2-space indent, UTF-8, final newline).
- **PostCSS:** `postcss ^8.5.3`, `@tailwindcss/postcss ^4.1.12`.
- **Environment:** `src/environments/environment.ts` with `apiUrl: 'http://localhost:8080'`.

## Testing Dependencies

- `@playwright/test ^1.64.0`
- `jsdom ^28.0.0`
- `vitest ^4.0.8`
- `dotenv ^18.0.7`

## Configuration

- `angular.json`: application builder, assets from `public/`, styles `src/styles.css`, scripts include ApexCharts bundle.
- `tsconfig.json`: strict-ish ES2022, path aliases for Spartan and `@nocteon/status-badge`.
- `tsconfig.app.json`: includes `src/**/*.ts` and `libs/ui/**/src/**/*.ts`; excludes specs.
- `tsconfig.spec.json`: unit test compilation.
- `tsconfig.e2e.json`: E2E compilation.

## Notable Constraints

- No separate production environment file; production build uses file replacement only for the notification mock (`notifications.mock.prod.ts`).
- Build budgets: initial 500kB warning / 1.6MB error; per-component-style 4kB / 8kB.
- `inlineFonts: false` in production optimization (added for v4 build).

---

*Stack analysis: 2026-10-26*
