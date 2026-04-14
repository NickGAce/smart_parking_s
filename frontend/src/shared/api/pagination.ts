import type { PaginationMeta } from '../types/common';

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export const withPagination = (pagination?: PaginationQuery): PaginationQuery => ({
  limit: pagination?.limit,
  offset: pagination?.offset,
});

export const getNextOffset = (meta: PaginationMeta): number | null => {
  const nextOffset = meta.offset + meta.limit;
  return nextOffset < meta.total ? nextOffset : null;
};
