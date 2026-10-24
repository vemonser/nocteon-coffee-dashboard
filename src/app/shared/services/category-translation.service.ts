import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CategoryTranslationService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/categories`;
  
  private categoryCache = new Map<string, string>();

  getCategoryName(slug: string, language: string = 'en'): Observable<string> {
    if (this.categoryCache.has(`${slug}-${language}`)) {
      return of(this.categoryCache.get(`${slug}-${language}`)!);
    }

    return this.http.get<any>(`${this.base}/${slug}`).pipe(
      map((response: any) => {
        const translations = response.data?.translations || [];
        const translation = translations.find((t: any) => t.language === language);
        const name = translation?.name || slug;
        this.categoryCache.set(`${slug}-${language}`, name);
        return name;
      }),
      catchError(() => of(slug))
    );
  }

  /**
   * Resolve several category names in one round trip.
   *
   * There is no `/categories/names` endpoint on the backend — asking for one
   * made "names" look like a category slug (404). The dashboard list endpoint
   * already returns every category with its translations, so we resolve from
   * that page and keep the result in the same cache.
   */
  getCategoryNames(slugs: string[], language: string = 'en'): Observable<Map<string, string>> {
    const wanted = new Set(slugs.filter(Boolean));
    return this.http
      .get<any>(this.base, { params: { page: 0, size: 100 } })
      .pipe(
        map((response: any) => {
          const nameMap = new Map<string, string>();
          const content = response.data?.content ?? [];
          for (const item of content) {
            if (!wanted.has(item.slug)) continue;
            const translation =
              item.translations?.find((t: any) => t.language === language) ??
              item.translations?.[0];
            const name = translation?.name || item.slug;
            nameMap.set(item.slug, name);
            this.categoryCache.set(`${item.slug}-${language}`, name);
          }
          return nameMap;
        }),
        catchError(() => of(new Map())),
      );
  }
}