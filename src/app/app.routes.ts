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
        path: 'store-settings',
        data: { breadcrumb: 'storeSettings' },
        canActivate: [permissionGuard('settings:read')],
        loadComponent: () =>
          import('./features/store-settings/components/store-settings-list.component').then(
            (m) => m.StoreSettingsListComponent,
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
        path: 'shipping-zones',
        data: { breadcrumb: 'shippingZones' },
        canActivate: [permissionGuard('shipping:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/shipping-zone/components/shipping-zone-list.component').then(
                (m) => m.ShippingZoneListComponent,
              ),
          },
          {
            path: ':id',
            data: { breadcrumb: 'shippingZoneDetail' },
            loadComponent: () =>
              import('./features/shipping-zone/shipping-zone-detail/components/shipping-zone-detail.component').then(
                (m) => m.ShippingZoneDetailComponent,
              ),
          },
        ],
      },

      {
        path: 'origins',
        data: { breadcrumb: 'origins' },
        canActivate: [permissionGuard('origins:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/origins/components/origins-list.component').then(
                (m) => m.OriginsListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'originDetail' },
            loadComponent: () =>
              import('./features/origins/origin-detail/components/origin-detail.component').then(
                (m) => m.OriginDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'farms',
        data: { breadcrumb: 'farms' },
        canActivate: [permissionGuard('farms:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/farms/components/farms-list.component').then(
                (m) => m.FarmsListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'farmDetail' },
            loadComponent: () =>
              import('./features/farms/farm-detail/components/farm-detail.component').then(
                (m) => m.FarmDetailComponent,
              ),
          },
        ],
      },

      {
        path: 'processing-methods',
        data: { breadcrumb: 'processing' },
        canActivate: [permissionGuard('processing_method:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/processing-method/components/processing-method-list.component').then(
                (m) => m.ProcessingMethodListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'processingDetail' },
            loadComponent: () =>
              import('./features/processing-method/processing-method-detail/components/processing-method-detail.component').then(
                (m) => m.ProcessingMethodDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'coffee-varieties',
        data: { breadcrumb: 'varieties' },
        canActivate: [permissionGuard('coffee_variety:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/coffee-variety/components/coffee-variety-list.component').then(
                (m) => m.CoffeeVarietyListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'varietyDetail' },
            loadComponent: () =>
              import('./features/coffee-variety/coffee-variety-detail/components/coffee-variety-detail.component').then(
                (m) => m.CoffeeVarietyDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'tasting-notes',
        data: { breadcrumb: 'tastingNotes' },
        canActivate: [permissionGuard('tasting_note:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/tasting-note/components/tasting-note-list.component').then(
                (m) => m.TastingNoteListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'tastingNoteDetail' },
            loadComponent: () =>
              import('./features/tasting-note/tasting-note-detail/components/tasting-note-detail.component').then(
                (m) => m.TastingNoteDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'reviews',
        data: { breadcrumb: 'reviews' },
        canActivate: [permissionGuard('review:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/reviews/components/review.component').then(
                (m) => m.ReviewListComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/reviews/components/review.component').then(
                (m) => m.ReviewListComponent,
              ),
          },
        ],
      },

      {
        path: 'brewing-methods',
        data: { breadcrumb: 'brewing' },
        canActivate: [permissionGuard('brewing_method:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/brewing-method/components/brewing-method-list.component').then(
                (m) => m.BrewingMethodsListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'brewingMethodDetail' },
            loadComponent: () =>
              import('./features/brewing-method/brewing-method-detail/components/brewing-method-detail.component').then(
                (m) => m.BrewingMethodDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'promo-codes',
        data: { breadcrumb: 'promoCodes' },
        canActivate: [permissionGuard('promo:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/promo-codes/components/promo-codes-list.component').then(
                (m) => m.PromoCodesListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'promoDetails' },
            loadComponent: () =>
              import('./features/promo-codes/promo-code-detail/components/promo-code-detail.component').then(
                (m) => m.PromoCodeDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'pairings',
        data: { breadcrumb: 'pairings' },
        canActivate: [permissionGuard('pairing:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/pairing/components/pairing-list.component').then(
                (m) => m.PairingListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'pairingDetail' },
            loadComponent: () =>
              import('./features/pairing/pairing-detail/components/pairing-detail.component').then(
                (m) => m.PairingDetailComponent,
              ),
          },
        ],
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
