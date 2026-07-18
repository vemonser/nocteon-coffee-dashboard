# AGENTS.md — NocteonDash

## Stack

- **Angular 22** (standalone components, signals, functional guards/interceptors)
- **TypeScript ~6.0** with strict options (`noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- **Tailwind CSS 4** via PostCSS plugin (`@tailwindcss/postcss`) — NOT the old `tailwind.config.js` approach
- **Spartan NG UI** (`@spartan-ng/helm/*`) — headless component library, components live in `libs/ui/`
- **TanStack Angular Table** for data tables
- **Vitest** (test runner, configured in `angular.json` architect, no separate vitest config file)
- **GSAP** for animations (color ripples, Flip transitions)
- **Transloco** (`@jsverse/transloco`) for i18n
- **ApexCharts** via `ng-apexcharts` (loaded as global script in `angular.json`)
- **Quill** via `ngx-quill` (rich text editor)

## Commands

```bash
npm start              # ng serve (dev server on :4200)
npm run build          # ng build (production)
npm run build -- --configuration development  # dev build
npm test               # ng test (Vitest)
ng generate component <name>  # scaffold component
```

**No linter or formatter command is configured** — Prettier is installed but has no npm script. Use `npx prettier --write <file>` if needed.

## Project Structure

```
src/
  app/
    core/           # Singleton services, guards, interceptors, models, providers
    features/       # Feature modules (one dir per domain entity)
    shared/         # Reusable components, pipes, utils, data
  environments/     # environment.ts (apiUrl: http://localhost:8080)
  styles/           # Global CSS: theme tokens, typography, radius, shadows
  public/assets/i18n/  # Translation JSONs (en.json, ar.json)
libs/ui/            # Spartan UI components (path-mapped via tsconfig.json)
```

## Architecture Patterns

### Base CRUD pattern

Most list pages extend `BaseListComponent<TResponse, TRequest, TId>` (`core/crud/base-list.component.ts`) which provides:
- Paginated data loading, search debounce, sorting
- Create/edit/delete dialog lifecycle
- Image upload preview
- Grid/list view toggle

Services extend `BaseCrudService<TResponse, TRequest, TId>` (`core/crud/base-crud.service.ts`) which provides `create()`, `update()`, `delete()` with multipart/json auto-detection.

To add a new CRUD feature:
1. Create model in `features/<name>/models/`
2. Create service extending `BaseCrudService` in `features/<name>/services/`
3. Create list component extending `BaseListComponent` — implement `getId()`, `loadPage()`, `buildForm()`, `toRequest()`, `callCreate()`, `callUpdate()`, `callDelete()`, `onEditOpen()`
4. Add route in `app.routes.ts` with `permissionGuard('<entity>:read')`

### Product Wizard

Products use a multi-step wizard (`product-wizard.component.ts`) with a shared state service (`product-wizard-state.service.ts`) provided at the route level (NOT root). Steps: Basic Info → Variants → Media → Tasting Notes → Pairings. The service holds a single `FormGroup` shared across all step components.

### i18n / Translations

- **Two languages**: English (`en`) and Arabic (`ar`)
- **Transloco** for UI translations — JSON files in `public/assets/i18n/`
- **Entity translations** are stored in API models as `translations: Array<{language, name, description?, ...}>` — NOT in Transloco JSON
- **TranslationFormHelper** (`shared/utils/translation.utils.ts`) builds FormArrays for bilingual entity forms — use `buildArray()` for create, `patchArray()` for edit
- **Language interceptor** adds `Accept-Language` header to all HTTP requests
- **RTL support**: `LanguageService` toggles `dir="rtl"` on `<html>` — CSS in `styles/index.css` handles font switching automatically
- **Navigation labels** are hardcoded in `shared/i18n/nav-i18n.ts` (not in Transloco) — update both `en` and `ar` when adding nav items

### Theming

- **Light/dark** mode via `ThemeService` — toggles `.dark` class on `<html>`
- **Accent colors**: `emerald` (default) and `burgundy` — toggled via `data-theme="burgundy"` attribute
- Theme CSS variables defined in `src/styles/themes/emerald.css` and `burgundy.css`
- Dark variants use `:root.dark` and `:root.dark[data-theme="burgundy"]` selectors
- **Fonts**: Inter (body) + Cormorant Garamond (headings) for English; Cairo + Almarai for Arabic — auto-switched via `[dir="rtl"]` CSS rules

### Auth & Permissions

- JWT-based auth with httpOnly cookie refresh
- `authGuard` protects all `/dashboard/*` routes
- `permissionGuard('entity:action')` checks route-level permissions
- `HasPermissionDirective` (`[hasPermission]="..."`) conditionally renders template blocks
- Admin role bypasses all permission checks
- Auth interceptor handles 401 → automatic token refresh with request queuing

### API Conventions

- All API responses wrapped in `ApiResponse<T>`: `{ success, message, data, errors, timestamp }`
- Paginated responses use `PageResponse<T>`: `{ content, page, size, totalElements, totalPages, first, last }`
- Base URL from `environment.apiUrl` (`http://localhost:8080`)
- Dashboard API prefix: `/api/dashboard/<entity>`
- Public API prefix: `/api/<entity>`
- Multipart uploads: JSON blob in `data` field + file in separate field

### Styling

- **Tailwind 4** — no `tailwind.config.js`, configured via `.postcssrc.json` and `@import "tailwindcss"` in `styles.css`
- **Spartan HLM preset** imported in `styles.css`: `@import "@spartan-ng/brain/hlm-tailwind-preset.css"`
- Component styles use Tailwind utility classes — most components use `styleUrl` or inline styles
- `ViewEncapsulation.None` used in layout components (sidebar, navigation)
- CSS custom properties for all theme tokens (colors, borders, etc.)

## Conventions

- All components are **standalone** (no NgModules)
- Prefer **signals** over RxJS for component state
- **Inject pattern**: `private service = inject(Service)` over constructor injection
- Icons imported per-component via `provideIcons()` in component `providers` array — use Lucide icon set (`@ng-icons/lucide`)
- Spartan UI imports use `HlmXxxImports` barrel imports (e.g., `HlmCardImports`, `HlmButtonImports`)
- Entity identifiers: `slug` for most catalog entities, numeric `id` for users/orders
- Default sort: `createdAt` desc
- Default page size: 20

## Gotchas

- `angular.json` includes `apexcharts.min.js` as a global script — ApexCharts must be loaded this way, not as an ES import
- `tsconfig.json` has ~60 path aliases for `@spartan-ng/helm/*` pointing to `libs/ui/*/src/index.ts` — the actual Spartan source lives in `libs/ui/`
- No `.spec.ts` files exist yet — the test infrastructure is set up (Vitest) but no tests are written
- The dev server has `allowedHosts: ["account-unpopular-parakeet.ngrok-free.dev"]` for external tunnel access
- `ProductService` does NOT extend `BaseCrudService` — it has its own `buildFormData` for multi-file uploads
- `CategoryService` overrides `update()` because the dashboard endpoint returns a different response type than the base CRUD
- Transloco JSON files (`public/assets/i18n/`) are for UI chrome only — entity translations (names, descriptions) are in the API response and managed via `TranslationFormHelper`
