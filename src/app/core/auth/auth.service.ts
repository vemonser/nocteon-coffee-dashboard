import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserResponse {
  id: number;
  email: string;
  username: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  permissions: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private base = environment.apiUrl;

  private _currentUser = signal<UserResponse | null>(null);
  private _accessToken = signal<string | null>(null);
  private _loading = signal(true);

  currentUser = this._currentUser.asReadonly();
  accessToken = this._accessToken.asReadonly();
  loading = this._loading.asReadonly();

  isLoggedIn = computed(() => !!this._currentUser());

  private refreshTimeout?: number;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  setSession(accessToken: string, user: UserResponse) {
    this._accessToken.set(accessToken);
    this._currentUser.set(user);
    this.startRefreshTimer();
  }

  clearSession() {
    this._accessToken.set(null);
    this._currentUser.set(null);

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }

  initializeSession() {
    return this.refresh().pipe(
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
      finalize(() => {
        this._loading.set(false);
      }),
    );
  }

  refresh(): Observable<any> {
    return this.http
      .post<any>(
        `${this.base}/api/auth/refresh`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((res) => {
          this.setSession(res.data.accessToken, res.data.user);
        }),
      );
  }

  login(identifier: string, password: string) {
    return this.http
      .post<any>(
        `${this.base}/api/auth/login`,
        {
          identifier,
          password,
        },
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap((res) => {
          this.setSession(res.data.accessToken, res.data.user);
        }),
      );
  }

  logout() {
    return this.http
      .post<any>(
        `${this.base}/api/auth/logout`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        }),
      );
  }

  hasPermission(permission: string): boolean {
    const user = this._currentUser();

    if (!user) {
      return false;
    }

    if (user.role === 'ADMIN') {
      return true;
    }

    return user.permissions?.includes(permission) ?? false;
  }

  getFullName(): string {
    const user = this._currentUser();

    if (!user) {
      return '';
    }

    if (user.firstName || user.lastName) {
      return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    }

    return user.username;
  }

  private startRefreshTimer() {
    const token = this._accessToken();

    if (!token) {
      return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));

    const expires = payload.exp * 1000;

    const timeout = expires - Date.now() - 30000;

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = window.setTimeout(
      () => {
        this.refresh().subscribe();
      },
      Math.max(timeout, 0),
    );
  }
}
