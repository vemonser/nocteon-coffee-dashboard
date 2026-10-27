import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { NotifyService } from '../notify/notify.service';
import { catchError, finalize, map, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * One in-flight refresh for every 401 that arrives while it runs. A completed
 * refresh is replayed to late subscribers; a failed one errors them all (and
 * is retried by the next 401), so no caller waits forever.
 */
let refresh$: Observable<string> | null = null;

function refreshToken(auth: AuthService): Observable<string> {
  refresh$ ??= auth.refresh().pipe(
    map((res) => res.data.accessToken as string),
    finalize(() => {
      refresh$ = null;
    }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  return refresh$;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notify = inject(NotifyService);

  if (!req.url.startsWith(environment.apiUrl) && !req.url.startsWith('/api')) {
    return next(req);
  }

  const token = auth.accessToken();

  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      })
    : req.clone({
        withCredentials: true,
      });

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 403) {
        // Global 403: show one toast and reject the request
        const slug = err.error?.slug ?? 'unknown';
        notify.apiError(err, 'permissions.actionDenied', `You don't have permission (${slug})`);
        return throwError(() => err);
      }

      // /auth/ requests report their own failure: refreshing on a failed
      // refresh (or a failed login) would loop.
      if (err.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => err);
      }

      return refreshToken(auth).pipe(
        // Only a failed *refresh* ends the session. A retried request that
        // still answers 401 is a problem with that endpoint, not proof that
        // the session is dead — clearing here logged admins out whenever a
        // secondary widget (nav counts, a forbidden read) failed.
        catchError((refreshError) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
        switchMap((freshToken) => {
          const retry = req.clone({
            setHeaders: {
              Authorization: `Bearer ${freshToken}`,
            },
            withCredentials: true,
          });

          return next(retry);
        }),
      );
    }),
  );
};
