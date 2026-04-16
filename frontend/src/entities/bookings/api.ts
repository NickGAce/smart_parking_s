import { httpClient } from '../../shared/api/http-client';
import { buildQueryParams } from '../../shared/api/query-params';
import type { QueryParams } from '../../shared/api/query-params';
import type { Booking, BookingListResponse, BookingsQuery, CreateBookingPayload, UpdateBookingPayload } from '../../shared/types/booking';

const mapBookingsQueryParams = (params?: BookingsQuery) => {
  if (!params) {
    return undefined;
  }

  const { statuses, ...rest } = params;
  const uniqueStatuses = statuses?.length ? Array.from(new Set(statuses)) : undefined;

  return {
    ...rest,
    ...(uniqueStatuses?.length ? { statuses: uniqueStatuses } : {}),
  };
};

export const bookingsApi = {
  getBookings: async (params?: BookingsQuery): Promise<BookingListResponse> => {
    const { data } = await httpClient.get<BookingListResponse>('/bookings', {
      params: mapBookingsQueryParams(params),
      paramsSerializer: (queryParams) => buildQueryParams(queryParams as QueryParams).toString(),
    });
    return data;
  },
  getMyBookings: async (): Promise<BookingListResponse> => {
    const { data } = await httpClient.get<BookingListResponse>('/bookings', { params: { mine: true } });
    return data;
  },
  getBookingById: async (bookingId: number): Promise<Booking> => {
    const { data } = await httpClient.get<Booking>(`/bookings/${bookingId}`);
    return data;
  },
  createBooking: async (payload: CreateBookingPayload): Promise<Booking> => {
    const { data } = await httpClient.post<Booking>('/bookings', payload);
    return data;
  },
  updateBooking: async (bookingId: number, payload: UpdateBookingPayload): Promise<Booking> => {
    const { data } = await httpClient.patch<Booking>(`/bookings/${bookingId}`, payload);
    return data;
  },
  deleteBooking: async (bookingId: number): Promise<void> => {
    await httpClient.delete(`/bookings/${bookingId}`);
  },
  checkIn: async (bookingId: number): Promise<Booking> => {
    const { data } = await httpClient.post<Booking>(`/bookings/${bookingId}/check-in`);
    return data;
  },
  checkOut: async (bookingId: number): Promise<Booking> => {
    const { data } = await httpClient.post<Booking>(`/bookings/${bookingId}/check-out`);
    return data;
  },
  markNoShow: async (bookingId: number): Promise<Booking> => {
    const { data } = await httpClient.post<Booking>(`/bookings/${bookingId}/mark-no-show`);
    return data;
  },
};
