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

  getCategoryNames(slugs: string[], language: string = 'en'): Observable<Map<string, string>> {
    return this.http.get<any>(`${this.base}/names?slugs=${slugs.join(',')}&language=${language}`).pipe(
      map((response: any) => {
        const nameMap = new Map<string, string>();
        response.data?.forEach((item: any) => {
          nameMap.set(item.slug, item.name);
          this.categoryCache.set(`${item.slug}-${language}`, item.name);
        });
        return nameMap;
      }),
      catchError(() => of(new Map()))
    );
  }
}