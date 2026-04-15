import type { BookingStatus, SortOrder } from '../../shared/types/common';
import type { BookingsQuery } from '../../shared/types/booking';

export const bookingStatuses: BookingStatus[] = ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired', 'no_show'];

export const bookingSortByOptions: NonNullable<BookingsQuery['sort_by']>[] = ['id', 'start_time', 'end_time', 'status'];
export const bookingSortOrderOptions: SortOrder[] = ['asc', 'desc'];
