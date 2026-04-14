import { httpClient } from '../../shared/api/http-client';
import type { Booking, BookingListResponse, BookingsQuery, CreateBookingPayload, UpdateBookingPayload } from '../../shared/types/booking';

export const bookingsApi = {
  getBookings: async (params?: BookingsQuery): Promise<BookingListResponse> => {
    const { data } = await httpClient.get<BookingListResponse>('/bookings', { params });
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
