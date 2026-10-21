"""Re-apply the page-size fixes (they were lost when the concurrent session
reset the working tree). Idempotent: each patch is skipped if it is already
in place."""

import io
import sys

BASE = "src/app/core/crud/base-crud.service.ts"
ORDER_SERVICE = "src/app/features/orders/services/order.service.ts"
ORDERS_LIST = "src/app/features/orders/orders-list/orders-list.component.ts"
PRODUCT_SERVICE = "src/app/features/products/services/product.service.ts"


def patch(path: str, old: str, new: str, label: str) -> None:
    with io.open(path, encoding="utf-8") as handle:
        text = handle.read()
    if new in text:
        print("already there:", label)
        return
    if old not in text:
        print("!! ANCHOR NOT FOUND:", label)
        sys.exit(1)
    with io.open(path, "w", encoding="utf-8") as handle:
        handle.write(text.replace(old, new))
    print("patched:", label)


# 1. The base CRUD service: the cap, and the clamp.
patch(
    BASE,
    """export abstract class BaseCrudService<TResponse, TRequest, TId = string> {
  protected readonly http = inject(HttpClient);
  protected abstract basePath: string;""",
    """export abstract class BaseCrudService<TResponse, TRequest, TId = string> {
  protected readonly http = inject(HttpClient);
  protected abstract basePath: string;

  /**
   * The biggest page the API accepts.
   *
   * Every dashboard list endpoint validates `size` and answers **400**
   * ("must be less than or equal to 100") for anything bigger — one
   * shared cap, verified against every list endpoint. A request that
   * asks for more is not a bigger page, it is a failed page.
   *
   * So the size is clamped here, once, and a caller that needs MORE
   * rows than a page has to walk the pages (see `getEvery*`).
   */
  protected static readonly MAX_PAGE_SIZE = 100;""",
    "the base service's cap",
)

patch(
    BASE,
    """  protected buildBaseParams(params: BaseListParams): HttpParams {
    let httpParams = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);""",
    """  protected buildBaseParams(params: BaseListParams): HttpParams {
    const size = Math.min(params.size ?? 20, BaseCrudService.MAX_PAGE_SIZE);
    let httpParams = new HttpParams().set('page', params.page ?? 0).set('size', size);""",
    "the base service's clamp",
)

# 2. The orders service: the clamp and the paged full read.
patch(
    ORDER_SERVICE,
    """export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/orders`;
""",
    """export class OrderService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/orders`;

  /** The biggest page the API accepts (`size` is validated, max 100). */
  private static readonly MAX_PAGE_SIZE = 100;

  /**
   * EVERY order of the filtered set — page after page.
   *
   * The API caps a page at 100 rows, so a full read has to walk the
   * pages. Asking for a thousand rows in one request gets a 400, and a
   * 400 inside a `forkJoin` takes the whole list down with it.
   */
  getEveryOrder(params: OrderFilterRequest = {}): Observable<OrderResponse[]> {
    const size = OrderService.MAX_PAGE_SIZE;
    return this.getAll({ ...params, page: 0, size }).pipe(
      // Walk the pages until one comes back short (the last one).
      expand((res, index) => {
        const content = res?.data?.content ?? [];
        if (content.length < size || index > 100) return EMPTY;
        return this.getAll({ ...params, page: index + 1, size });
      }),
      toArray(),
      map((pages) => pages.flatMap((p) => p?.data?.content ?? [])),
    );
  }
""",
    "the order service's paged read",
)

patch(
    ORDER_SERVICE,
    """  getAll(params: OrderFilterRequest = {}): Observable<ApiResponse<PageResponse<OrderResponse>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);""",
    """  getAll(params: OrderFilterRequest = {}): Observable<ApiResponse<PageResponse<OrderResponse>>> {
    // The API validates `size` and answers 400 for anything above 100
    // ("must be less than or equal to 100"), so a request that asks for
    // more than a page is a FAILED page, not a bigger one.
    const size = Math.min(params.size ?? 20, OrderService.MAX_PAGE_SIZE);
    let p = new HttpParams().set('page', params.page ?? 0).set('size', size);""",
    "the order service's clamp",
)

patch(
    ORDER_SERVICE,
    "import { Observable, forkJoin, map, of, switchMap } from 'rxjs';",
    "import { EMPTY, Observable, expand, forkJoin, map, of, switchMap, toArray } from 'rxjs';",
    "the order service's imports",
)

# 3. The orders list: the paged read for the KPI aggregate.
patch(
    ORDERS_LIST,
    """      // Full read of the filtered set to compute revenue/avg until the
      // backend exposes them on the stats endpoint (see API_GAPS.md).
      kpiRows: this.orderService.getAll({
        page: 0,
        size: 1000,
        status: status === 'ALL' ? undefined : status,
        ...filter,
      }),""",
    """      // Full read of the filtered set to compute revenue/avg until the
      // backend exposes them on the stats endpoint (see API_GAPS.md).
      // It WALKS the pages: the API caps a page at 100 rows, so a single
      // "size: 1000" request was a 400 — and a 400 inside this forkJoin
      // left the whole list stuck on "Loading".
      kpiRows: this.orderService.getEveryOrder({
        status: status === 'ALL' ? undefined : status,
        ...filter,
      }),""",
    "the orders list's paged read",
)

patch(
    ORDERS_LIST,
    "        const allRows = kpiRows.data?.content ?? [];",
    "        const allRows = kpiRows;",
    "the orders list's rows",
)

# 4. The product service (it does not extend the base CRUD service).
patch(
    PRODUCT_SERVICE,
    """export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/products`;
""",
    """export class ProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dashboard/products`;

  /** The biggest page the API accepts (`size` is validated, max 100). */
  private static readonly MAX_PAGE_SIZE = 100;
""",
    "the product service's cap",
)

patch(
    PRODUCT_SERVICE,
    """  getAll(params: ProductListParams = {}): Observable<ApiResponse<PageResponse<ProductListItem>>> {
    let p = new HttpParams().set('page', params.page ?? 0).set('size', params.size ?? 20);""",
    """  getAll(params: ProductListParams = {}): Observable<ApiResponse<PageResponse<ProductListItem>>> {
    // The API validates `size` and answers 400 for anything above 100
    // ("must be less than or equal to 100"), so a request that asks for
    // more than a page is a FAILED page, not a bigger one. The product
    // service does not extend the base CRUD service, so the cap is
    // applied here.
    const size = Math.min(params.size ?? 20, ProductService.MAX_PAGE_SIZE);
    let p = new HttpParams().set('page', params.page ?? 0).set('size', size);""",
    "the product service's clamp",
)

print("done")
