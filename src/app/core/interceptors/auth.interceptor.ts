import {
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import {
  BehaviorSubject,
  catchError,
  filter,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';

let refreshInProgress = false;

const refreshSubject =
  new BehaviorSubject<string | null>(
    null,
  );

export const authInterceptor:
  HttpInterceptorFn = (
    req,
    next,
  ) => {
    const auth =
      inject(AuthService);

    if (
      !req.url.startsWith(
        environment.apiUrl,
      ) &&
      !req.url.startsWith('/api')
    ) {
      return next(req);
    }

    const token =
      auth.accessToken();

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
        if (
          err.status !== 401 ||
          req.url.includes(
            '/auth/',
          )
        ) {
          return throwError(
            () => err,
          );
        }

        if (refreshInProgress) {
          return refreshSubject.pipe(
            filter(
              (
                token,
              ): token is string =>
                token !== null,
            ),
            take(1),
            switchMap((token) => {
              const retry =
                req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${token}`,
                  },
                  withCredentials: true,
                });

              return next(retry);
            }),
          );
        }

        refreshInProgress =
          true;

        refreshSubject.next(
          null,
        );

        return auth.refresh().pipe(
          switchMap((res) => {
            refreshInProgress =
              false;

            const token =
              res.data.accessToken;

            refreshSubject.next(
              token,
            );

            const retry =
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${token}`,
                },
                withCredentials: true,
              });

            return next(retry);
          }),
          catchError(
            (
              refreshError,
            ) => {
              refreshInProgress =
                false;

              auth.clearSession();

              return throwError(
                () =>
                  refreshError,
              );
            },
          ),
        );
      }),
    );
  };