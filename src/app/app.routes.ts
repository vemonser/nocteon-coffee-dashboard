import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';

// app.routes.ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'users',
        data: { breadcrumb: 'users' },
        canActivate: [permissionGuard('user:read')],
        loadComponent: () =>
          import('./features/users/components/users-list.component').then(
            (m) => m.UsersListComponent,
          ),
      },
      {
        path: 'categories',
        data: { breadcrumb: 'categories' },
        canActivate: [permissionGuard('category:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/categories/components/categories-list.component').then(
                (m) => m.CategoriesListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'categoryDetail' },
            loadComponent: () =>
              import('./features/categories/category-detail/components/category-detail.component').then(
                (m) => m.CategoryDetailComponent,
              ),
          },
        ],
      },

      {
        path: 'roast-levels',
        data: { breadcrumb: 'roastLevels' },
        canActivate: [permissionGuard('roast_level:read')],
        loadComponent: () =>
          import('./features/roast-level/components/roast-level-list.component').then(
            (m) => m.RoastLevelListComponent,
          ),
      },
      {
        path: 'origins',
        data: { breadcrumb: 'origins' },
        canActivate: [permissionGuard('origins:read')],
        loadComponent: () =>
          import('./features/origins/components/origins-list.component').then(
            (m) => m.OriginsListComponent,
          ),
      },
      {
        path: 'farms',
        data: { breadcrumb: 'farms' },
        canActivate: [permissionGuard('farms:read')],
        loadComponent: () =>
          import('./features/farms/components/farms-list.component').then(
            (m) => m.FarmsListComponent,
          ),
      },
      {
        path: 'processing-methods',
        data: { breadcrumb: 'processing' },
        canActivate: [permissionGuard('processing_method:read')],
        loadComponent: () =>
          import('./features/processing-method/components/processing-method-list.component').then(
            (m) => m.ProcessingMethodListComponent,
          ),
      },
      {
        path: 'coffee-varieties',
        data: { breadcrumb: 'varieties' },
        canActivate: [permissionGuard('coffee_variety:read')],
        loadComponent: () =>
          import('./features/coffee-variety/components/coffee-variety-list.component').then(
            (m) => m.CoffeeVarietyListComponent,
          ),
      },
      {
        path: 'tasting-notes',
        data: { breadcrumb: 'tastingNotes' },
        canActivate: [permissionGuard('tasting_note:read')],
        loadComponent: () =>
          import('./features/tasting-note/components/tasting-note-list.component').then(
            (m) => m.TastingNoteListComponent,
          ),
      },
      {
        path: 'reviews',
        data: { breadcrumb: 'reviews' },
        canActivate: [permissionGuard('review:read')],
        loadComponent: () =>
          import('./features/reviews/components/review.component').then((m) => m.ReviewComponent),
      },
      {
        path: 'brewing-methods',
        data: { breadcrumb: 'brewing' },
        canActivate: [permissionGuard('brewing_method:read')],
        loadComponent: () =>
          import('./features/brewing-method/components/brewing-method-list.component').then(
            (m) => m.BrewingMethodListComponent,
          ),
      },
      {
        path: 'pairings',
        data: { breadcrumb: 'pairings' },
        canActivate: [permissionGuard('pairing:read')],
        loadComponent: () =>
          import('./features/pairing/components/pairing-list.component').then(
            (m) => m.PairingListComponent,
          ),
      },
      {
        path: 'products',
        data: { breadcrumb: 'products' },
        canActivate: [permissionGuard('product:read')],
        loadComponent: () =>
          import('./features/products/components/products-list/products-list.component').then(
            (m) => m.ProductsListComponent,
          ),
      },
      {
        path: 'products/new',
        data: { breadcrumb: 'newProduct' },
        loadComponent: () =>
          import('./features/products/components/product-wizard/product-wizard.component').then(
            (m) => m.ProductWizardComponent,
          ),
      },
      {
        path: 'products/:slug/edit',
        data: { breadcrumb: 'products' },
        loadComponent: () =>
          import('./features/products/components/product-wizard/product-wizard.component').then(
            (m) => m.ProductWizardComponent,
          ),
      },
      {
        path: 'orders',
        data: { breadcrumb: 'orders' },
        canActivate: [permissionGuard('order:read')],
        loadComponent: () =>
          import('./features/orders/orders-list/orders-list.component').then(
            (m) => m.OrdersListComponent,
          ),
      },
    ],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
