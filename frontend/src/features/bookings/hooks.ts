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
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all, refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.detail(bookingId), refetchType: 'active' }),
    queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.all, refetchType: 'active' }),
  ]);
}

export function useBookingsQuery(params?: BookingsQuery, options?: LiveQueryOptions) {
  const liveInterval = options?.refetchIntervalMs;
  return useQuery({
    queryKey: bookingsQueryKeys.list(params),
    queryFn: () => bookingApi.getBookings(params),
    refetchInterval: liveInterval,
    refetchOnWindowFocus: liveInterval ? false : true,
    staleTime: liveInterval ? Math.max(3_000, Math.floor(liveInterval / 2)) : 10_000,
    gcTime: 5 * 60_000,
  });
}

export function useMyBookingsQuery(params?: Omit<BookingsQuery, 'mine'>, options?: LiveQueryOptions) {
  const query: BookingsQuery = { ...params, mine: true };
  const liveInterval = options?.refetchIntervalMs;
  return useQuery({
    queryKey: bookingsQueryKeys.mine(query),
    queryFn: () => bookingApi.getBookings(query),
    refetchInterval: liveInterval,
    refetchOnWindowFocus: liveInterval ? false : true,
    staleTime: liveInterval ? Math.max(3_000, Math.floor(liveInterval / 2)) : 10_000,
    gcTime: 5 * 60_000,
  });
}

export function useBookingQuery(bookingId: number, options?: LiveQueryOptions) {
  const liveInterval = options?.refetchIntervalMs;
  return useQuery({
    queryKey: bookingsQueryKeys.detail(bookingId),
    queryFn: () => bookingApi.getBookingById(bookingId),
    enabled: Number.isFinite(bookingId) && bookingId > 0,
    refetchInterval: liveInterval,
    refetchOnWindowFocus: liveInterval ? false : true,
    staleTime: liveInterval ? Math.max(3_000, Math.floor(liveInterval / 2)) : 10_000,
    gcTime: 5 * 60_000,
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
