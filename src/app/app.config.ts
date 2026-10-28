import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import {
  httpProviders,
  provideAppIcons,
  provideAppInitializers,
  provideAppTransloco,
} from './core/providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withViewTransitions()),
    ...httpProviders,
    provideAppTransloco(),
    provideAppInitializers(),
    provideAppIcons(),
  ],
};
