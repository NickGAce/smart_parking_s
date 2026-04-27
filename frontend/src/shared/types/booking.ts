import type { BookingStatus, ListResponse, SortOrder, SpotType, VehicleType } from './common';
import type { DecisionReport } from './recommendation';

export type BookingType = 'guest' | 'rental';

export interface Booking {
  id: number;
  user_id: number;
  parking_spot_id: number;
  vehicle_id?: number | null;
  type: BookingType;
  status: BookingStatus;
  plate_number?: string | null;
  start_time: string;
  end_time: string;
  assignment_mode: 'manual' | 'auto' | string;
  assignment_explanation: string | null;
  assignment_metadata?: Record<string, unknown> | null;
  decision_report?: DecisionReport | null;
}

export interface RecommendationWeights {
  availability?: number;
  spot_type?: number;
  zone?: number;
  charger?: number;
  role?: number;
  conflict?: number;
}

export interface RecommendationFilters {
  spot_types?: SpotType[];
  zone_ids?: number[];
  vehicle_type?: VehicleType;
  size_category?: 'small' | 'medium' | 'large';
  requires_charger?: boolean;
}

export interface RecommendationPreferences {
  preferred_spot_types?: SpotType[];
  preferred_zone_ids?: number[];
  prefer_charger?: boolean;
  needs_accessible_spot?: boolean;
  max_results?: number;
}

export interface CreateBookingPayload {
  start_time: string;
  end_time: string;
  parking_spot_id?: number;
  vehicle_id?: number;
  type?: BookingType;
  plate_number?: string;
  auto_assign?: boolean;
  parking_lot_id?: number;
  recommendation_filters?: RecommendationFilters;
  recommendation_preferences?: RecommendationPreferences;
  recommendation_weights?: RecommendationWeights;
}

export interface UpdateBookingPayload {
  start_time?: string;
  end_time?: string;
  type?: BookingType;
  plate_number?: string;
  status?: BookingStatus;
}

export interface BookingsQuery {
  mine?: boolean;
  parking_lot_id?: number;
  parking_spot_id?: number;
  vehicle_id?: number;
  from?: string;
  to?: string;
  status?: BookingStatus;
  statuses?: BookingStatus[];
  limit?: number;
  offset?: number;
  sort_by?: 'start_time' | 'end_time' | 'status' | 'id';
  sort_order?: SortOrder;
}

export type BookingListResponse = ListResponse<Booking>;
