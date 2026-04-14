import { useQuery } from '@tanstack/react-query';

import { bookingApi } from '../../entities/booking/api';

export function useMyBookingsQuery() {
  return useQuery({
    queryKey: ['my-bookings'],
    queryFn: bookingApi.getMyBookings,
  });
}
