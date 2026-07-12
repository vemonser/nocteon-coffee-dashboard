import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
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
    provideRouter(routes),
    ...httpProviders,
    provideAppTransloco(),
    provideAppInitializers(),
    provideAppIcons(),
  ],
};
