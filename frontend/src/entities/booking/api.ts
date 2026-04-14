import { httpClient } from '../../shared/api/http-client';
import type { BookingListResponse } from '../../shared/types/booking';

export const bookingApi = {
  getMyBookings: async (): Promise<BookingListResponse> => {
    const { data } = await httpClient.get<BookingListResponse>('/bookings', {
      params: { mine: true },
    });

    return data;
  },
};
