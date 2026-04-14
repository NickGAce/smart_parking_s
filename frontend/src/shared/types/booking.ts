import type { PaginatedResponse } from './common';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_show';

export interface Booking {
  id: number;
  status: BookingStatus;
  parking_lot_id: number;
  parking_spot_id: number;
  start_time: string;
  end_time: string;
  assignment_mode?: string;
}

export type BookingListResponse = PaginatedResponse<Booking>;
