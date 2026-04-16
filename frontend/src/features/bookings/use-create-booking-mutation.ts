import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bookingApi } from '../../entities/booking/api';
import type { CreateBookingPayload, Booking } from '../../shared/types/booking';
import type { ApiError } from '../../shared/types/common';
import { parkingSpotsQueryKeys } from '../parking-spots/query-keys';
import { bookingsQueryKeys } from './query-keys';

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation<Booking, ApiError, CreateBookingPayload>({
    mutationFn: bookingApi.createBooking,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.all });
    },
  });
}
