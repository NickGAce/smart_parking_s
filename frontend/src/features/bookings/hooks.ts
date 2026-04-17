import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookingApi } from '../../entities/booking/api';
import type { Booking, BookingsQuery, UpdateBookingPayload } from '../../shared/types/booking';
import type { ApiError } from '../../shared/types/common';
import { bookingsQueryKeys } from './query-keys';
import { parkingSpotsQueryKeys } from '../parking-spots/query-keys';

interface LiveQueryOptions {
  refetchIntervalMs?: number;
}

async function refreshOperationalData(queryClient: ReturnType<typeof useQueryClient>, bookingId: number) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.detail(bookingId) }),
    queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.all }),
  ]);
}

export function useBookingsQuery(params?: BookingsQuery, options?: LiveQueryOptions) {
  return useQuery({
    queryKey: bookingsQueryKeys.list(params),
    queryFn: () => bookingApi.getBookings(params),
    refetchInterval: options?.refetchIntervalMs,
    staleTime: 0,
  });
}

export function useMyBookingsQuery(params?: Omit<BookingsQuery, 'mine'>, options?: LiveQueryOptions) {
  const query: BookingsQuery = { ...params, mine: true };
  return useQuery({
    queryKey: bookingsQueryKeys.mine(query),
    queryFn: () => bookingApi.getBookings(query),
    refetchInterval: options?.refetchIntervalMs,
    staleTime: 0,
  });
}

export function useBookingQuery(bookingId: number, options?: LiveQueryOptions) {
  return useQuery({
    queryKey: bookingsQueryKeys.detail(bookingId),
    queryFn: () => bookingApi.getBookingById(bookingId),
    enabled: Number.isFinite(bookingId) && bookingId > 0,
    refetchInterval: options?.refetchIntervalMs,
    staleTime: 0,
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
    onSuccess: async () => {
      await refreshOperationalData(queryClient, bookingId);
    },
  });
}

export function useCheckInBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation<Booking, ApiError, number>({
    mutationFn: (bookingId) => bookingApi.checkIn(bookingId),
    onSettled: async (_, __, bookingId) => {
      await refreshOperationalData(queryClient, bookingId);
    },
  });
}

export function useCheckOutBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation<Booking, ApiError, number>({
    mutationFn: (bookingId) => bookingApi.checkOut(bookingId),
    onSettled: async (_, __, bookingId) => {
      await refreshOperationalData(queryClient, bookingId);
    },
  });
}

export function useMarkNoShowBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation<Booking, ApiError, number>({
    mutationFn: (bookingId) => bookingApi.markNoShow(bookingId),
    onSettled: async (_, __, bookingId) => {
      await refreshOperationalData(queryClient, bookingId);
    },
  });
}
