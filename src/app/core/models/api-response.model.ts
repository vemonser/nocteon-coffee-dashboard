// src/app/core/models/api-response.model.ts
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    errors: FieldError[] | null;
    timestamp: string;
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