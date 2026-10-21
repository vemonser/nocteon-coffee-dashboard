import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';
import { UnsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { NotificationListComponent } from './features/notifications-list/components/notification-list.component';

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
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/users/components/users-list.component').then(
                (m) => m.UsersListComponent,
              ),
          },
          {
            path: ':id',
            data: { breadcrumb: 'userDetails' },
            loadComponent: () =>
              import('./features/users/user-detail/components/user-detail.component').then(
                (m) => m.UserDetailComponent,
              ),
          },
        ],
      },
      {
        path: 'journal',
        data: { breadcrumb: 'journal' },
        canActivate: [permissionGuard('journal:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/journal/components/journal-list.component').then(
                (m) => m.JournalListComponent,
              ),
          },
          {
            path: 'new',
            data: { breadcrumb: 'newJournalPost' },
            loadComponent: () =>
              import('./features/journal/components/journal-form.component').then(
                (m) => m.JournalFormComponent,
              ),
          },
          {
            path: ':slug/edit',
            data: { breadcrumb: 'editJournalPost' },
            loadComponent: () =>
              import('./features/journal/components/journal-form.component').then(
                (m) => m.JournalFormComponent,
              ),
          },
        ],
      },
      {
        path: 'store-settings',
        data: { breadcrumb: 'storeSettings' },
        canActivate: [permissionGuard('settings:update')],
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
            canDeactivate: [UnsavedChangesGuard],
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
        canActivate: [permissionGuard('origin:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/origins/components/origins-list.component').then(
                (m) => m.OriginsListComponent,
              ),
          },
          {
            path: 'new',
            data: { breadcrumb: 'newOrigin' },
            canDeactivate: [UnsavedChangesGuard],
            loadComponent: () =>
              import('./features/origins/origin-detail/components/origin-detail.component').then(
                (m) => m.OriginDetailComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'originDetail' },
            canDeactivate: [UnsavedChangesGuard],
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
        canActivate: [permissionGuard('farm:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/farms/components/farms-list.component').then(
                (m) => m.FarmsListComponent,
              ),
          },
          {
            path: 'new',
            data: { breadcrumb: 'newFarm' },
            canDeactivate: [UnsavedChangesGuard],
            loadComponent: () =>
              import('./features/farms/farm-detail/components/farm-detail.component').then(
                (m) => m.FarmDetailComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'farmDetail' },
            canDeactivate: [UnsavedChangesGuard],
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
        path: 'roast-levels',
        data: { breadcrumb: 'roastLevels' },
        canActivate: [permissionGuard('roast_level:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/roast-level/components/roast-level-list.component').then(
                (m) => m.RoastLevelListComponent,
              ),
          },
          {
            path: ':slug',
            data: { breadcrumb: 'roastLevelDetail' },
            loadComponent: () =>
              import('./features/roast-level/roast-level-detail/components/roast-level-detail.component').then(
                (m) => m.RoastLevelDetailComponent,
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
        canActivate: [permissionGuard('review:moderate')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/reviews/components/review-list.component').then(
                (m) => m.ReviewListComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/reviews/components/review-list.component').then(
                (m) => m.ReviewListComponent,
              ),
          },
        ],
      },

      {
        path: 'product-options',
        data: { breadcrumb: 'productOptions' },
        canActivate: [permissionGuard('product_option:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/product-options/components/product-option-list.component').then(
                (m) => m.ProductOptionListComponent,
              ),
          },
        ],
      },

      {
        path: 'newsletter',
        data: { breadcrumb: 'newsletter' },
        canActivate: [permissionGuard('user:read')],
        loadComponent: () =>
          import('./features/newsletter/components/newsletter-list.component').then(
            (m) => m.NewsletterListComponent,
          ),
      },
      {
        path: 'broadcasts',
        data: { breadcrumb: 'broadcasts' },
        canActivate: [permissionGuard('broadcast:read')],
        loadComponent: () =>
          import('./features/broadcasts/components/broadcast-list.component').then(
            (m) => m.BroadcastListComponent,
          ),
      },

      {
        path: 'contact-messages',
        data: { breadcrumb: 'contactMessages' },
        canActivate: [permissionGuard('contact:read')],
        loadComponent: () =>
          import('./features/contact-messages/components/contact-messages-list.component').then(
            (m) => m.ContactMessagesListComponent,
          ),
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
        path: 'notifications',
        data: { breadcrumb: 'notification' },
        canActivate: [permissionGuard('notification:read')],
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/notifications-list/components/notification-list.component').then(
                (m) => m.NotificationListComponent,
              ),
          },
          {
            path: ':id',
            data: { breadcrumb: 'notificationDetails' },
            loadComponent: () =>
              import('./features/notifications-list/components/notification-list.component').then(
                (m) => m.NotificationListComponent,
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
        canActivate: [permissionGuard('product:create')],
        loadComponent: () =>
          import('./features/products/components/product-wizard/product-wizard.component').then(
            (m) => m.ProductWizardComponent,
          ),
      },
      {
        path: 'products/:slug/edit',
        data: { breadcrumb: 'products' },
        canActivate: [permissionGuard('product:update')],
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
      {
        path: 'orders/:id',
        data: { breadcrumb: 'orderDetail' },
        canActivate: [permissionGuard('order:read')],
        loadComponent: () =>
          import('./features/orders/order-detail/order-detail.component').then(
            (m) => m.OrderDetailComponent,
          ),
      },
      {
        path: 'carts',
        data: { breadcrumb: 'carts' },
        canActivate: [permissionGuard('cart:manage')],
        loadComponent: () =>
          import('./features/carts/components/carts-list.component').then(
            (m) => m.CartsListComponent,
          ),
      },
      {
        path: 'profile',
        data: { breadcrumb: 'profile' },
        loadComponent: () =>
          import('./features/profile/components/profile.component').then(
            (m) => m.ProfileComponent,
          ),
      },
    ],
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },
];
