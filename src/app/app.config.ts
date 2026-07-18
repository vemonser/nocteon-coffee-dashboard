import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import {
  httpProviders,
  provideAppIcons,
  provideAppInitializers,
  provideAppTransloco,
} from './core/providers';
import { provideQuillConfig } from 'ngx-quill';

export const appConfig: ApplicationConfig = {
  providers: [
    provideQuillConfig({
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ header: [1, 2, 3, false] }],
          ['link', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['clean'],
        ],
      },
    }),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    ...httpProviders,
    provideAppTransloco(),
    provideAppInitializers(),
    provideAppIcons(),
  ],
};
