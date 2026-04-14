export type UserRole = 'admin' | 'owner' | 'tenant' | 'guard' | 'uk';

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  detail: string;
}
