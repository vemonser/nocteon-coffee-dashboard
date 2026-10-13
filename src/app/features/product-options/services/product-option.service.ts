import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { ApiResponse, PageResponse } from '../../../core/models/api-response.model';
import { BaseCrudService, BaseListParams } from '../../../core/crud/base-crud.service';
import { environment } from '../../../../environments/environment';
import {
  ProductOption,
  ProductOptionRequest,
  ProductOptionValue,
  ProductOptionValueRequest,
} from '../models/product-option.model';

@Injectable({ providedIn: 'root' })
export class ProductOptionService extends BaseCrudService<
  ProductOption,
  ProductOptionRequest,
  number
> {
  protected override basePath = '/api/dashboard/product-options';

  getAll(
    params: BaseListParams = {},
  ): Observable<ApiResponse<PageResponse<ProductOption>>> {
    const p = this.buildBaseParams(params);
    return this.http.get<ApiResponse<PageResponse<ProductOption>>>(this.fullUrl, { params: p });
  }

  getById(optionId: number): Observable<ApiResponse<ProductOption>> {
    return this.http.get<ApiResponse<ProductOption>>(`${this.fullUrl}/${optionId}`);
  }

  createValue(
    optionId: number,
    req: ProductOptionValueRequest,
  ): Observable<ApiResponse<ProductOptionValue>> {
    return this.http.post<ApiResponse<ProductOptionValue>>(
      `${this.fullUrl}/${optionId}/values`,
      req,
    );
  }

  deleteValue(optionId: number, valueId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.fullUrl}/${optionId}/values/${valueId}`);
  }

  attachToProduct(productId: number, optionId: number): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${environment.apiUrl}/api/dashboard/products/${productId}/options/${optionId}`,
      null,
    );
  }

  detachFromProduct(productId: number, optionId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${environment.apiUrl}/api/dashboard/products/${productId}/options/${optionId}`,
    );
  }
}