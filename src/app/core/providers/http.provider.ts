import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import { authInterceptor } from '../interceptors/auth.interceptor';
import { languageInterceptor } from '../interceptors/language.interceptor';

export const httpProviders = [
  provideHttpClient(
    withInterceptors([
      authInterceptor,
      languageInterceptor,
    ]),
  ),
];