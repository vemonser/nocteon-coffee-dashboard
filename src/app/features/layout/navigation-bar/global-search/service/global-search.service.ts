import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GlobalSearchResponse } from '../model/search.model';
import { environment } from '../../../../../../environments/environment';
import { ApiResponse } from '../../../../../core/models/api-response.model';


@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private http = inject(HttpClient);

  search(query: string): Observable<GlobalSearchResponse> {
    return this.http
      .get<ApiResponse<GlobalSearchResponse>>(`${environment.apiUrl}/api/dashboard/search`, {
        params: { query },
      })
      .pipe(map((res) => res.data));
  }
}