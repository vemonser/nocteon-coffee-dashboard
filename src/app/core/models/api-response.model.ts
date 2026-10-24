// src/app/core/models/api-response.model.ts
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    errors: FieldError[] | null;
    timestamp: string;
    /** Aggregate counters some list endpoints return alongside the page. */
    summary?: ListSummary | null;
}

export interface ListSummary {
    total: number;
    admins: number;
    customers: number;
    blocked: number;
    unverified: number;
}

export interface FieldError {
    field: string;
    message: string;
}

export interface PageResponse<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
}