import type { BookingsQuery } from '../../shared/types/booking';

export const bookingsQueryKeys = {
  all: ['bookings'] as const,
  list: (params?: BookingsQuery) => [...bookingsQueryKeys.all, 'list', params ?? {}] as const,
  mine: (params?: BookingsQuery) => [...bookingsQueryKeys.all, 'mine', params ?? {}] as const,
  detail: (bookingId: number) => [...bookingsQueryKeys.all, 'detail', bookingId] as const,
};
