import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookingApi } from '../../entities/booking/api';
import type { Booking, BookingsQuery, UpdateBookingPayload } from '../../shared/types/booking';
import type { ApiError } from '../../shared/types/common';
import { bookingsQueryKeys } from './query-keys';

export function useBookingsQuery(params?: BookingsQuery) {
  return useQuery({
    queryKey: bookingsQueryKeys.list(params),
    queryFn: () => bookingApi.getBookings(params),
  });
}

export function useMyBookingsQuery(params?: Omit<BookingsQuery, 'mine'>) {
  const query: BookingsQuery = { ...params, mine: true };
  return useQuery({
    queryKey: bookingsQueryKeys.mine(query),
    queryFn: () => bookingApi.getBookings(query),
  });
}

export function useBookingQuery(bookingId: number) {
  return useQuery({
    queryKey: bookingsQueryKeys.detail(bookingId),
    queryFn: () => bookingApi.getBookingById(bookingId),
    enabled: Number.isFinite(bookingId) && bookingId > 0,
  });
}

export function useUpdateBookingMutation(bookingId: number) {
  const queryClient = useQueryClient();

  return useMutation<Booking, ApiError, UpdateBookingPayload>({
    mutationFn: (payload) => bookingApi.updateBooking(bookingId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.detail(bookingId) });
    },
  });
}

export function useCancelBookingMutation(bookingId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, void>({
    mutationFn: () => bookingApi.deleteBooking(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.detail(bookingId) });
    },
  });
}
