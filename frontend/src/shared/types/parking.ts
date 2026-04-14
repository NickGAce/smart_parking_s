import type { ListResponse, SizeCategory, SortOrder, SpotEffectiveStatus, SpotRawStatus, SpotType, UserRole, VehicleType } from './common';

export type AccessMode = 'employees_only' | 'guests_only' | 'mixed';

export interface WorkingHourItem {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface ScheduleExceptionItem {
  date: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface ParkingLot {
  id: number;
  owner_id: number | null;
  name: string;
  address: string;
  total_spots: number;
  guest_spot_percentage: number;
  access_mode: AccessMode;
  allowed_user_roles: UserRole[];
  min_booking_minutes: number;
  max_booking_minutes: number;
  booking_step_minutes: number;
  max_advance_minutes: number;
}

export interface ParkingLotRules {
  parking_lot_id: number;
  access_mode: AccessMode;
  allowed_user_roles: UserRole[];
  min_booking_minutes: number;
  max_booking_minutes: number;
  booking_step_minutes: number;
  max_advance_minutes: number;
  working_hours: WorkingHourItem[];
  exceptions: ScheduleExceptionItem[];
}

export interface ParkingSpot {
  id: number;
  spot_number: number;
  parking_lot_id: number;
  status: SpotRawStatus;
  effective_status: SpotEffectiveStatus;
  spot_type: SpotType;
  type: string;
  vehicle_type: VehicleType;
  has_charger: boolean;
  size_category: SizeCategory;
  zone_id: number | null;
  zone_name: string | null;
}

export interface ParkingLotsQuery {
  limit?: number;
  offset?: number;
  sort_by?: 'id' | 'name' | 'total_spots';
  sort_order?: SortOrder;
}

export interface ParkingSpotsQuery {
  from?: string;
  to?: string;
  spot_type?: SpotType;
  vehicle_type?: VehicleType;
  size_category?: SizeCategory;
  has_charger?: boolean;
  zone_id?: number;
  zone_name?: string;
  parking_lot_id?: number;
  status?: SpotRawStatus;
  limit?: number;
  offset?: number;
  sort_by?: 'id' | 'spot_number' | 'status' | 'spot_type' | 'vehicle_type' | 'size_category';
  sort_order?: SortOrder;
}

export interface CreateParkingLotPayload {
  name: string;
  address: string;
  total_spots: number;
  guest_spot_percentage?: number;
  access_mode?: AccessMode;
  allowed_user_roles?: UserRole[];
  min_booking_minutes?: number;
  max_booking_minutes?: number;
  booking_step_minutes?: number;
  max_advance_minutes?: number;
}

export type UpdateParkingLotPayload = Partial<CreateParkingLotPayload>;

export interface CreateParkingSpotPayload {
  spot_number: number;
  parking_lot_id: number;
  spot_type?: SpotType;
  vehicle_type?: VehicleType;
  zone_id?: number;
  zone_name?: string;
  has_charger?: boolean;
  size_category?: SizeCategory;
  type?: string;
}

export interface UpdateParkingSpotPayload {
  spot_number?: number;
  status?: SpotRawStatus;
  spot_type?: SpotType;
  type?: string;
  vehicle_type?: VehicleType;
  zone_id?: number;
  zone_name?: string;
  has_charger?: boolean;
  size_category?: SizeCategory;
  parking_lot_id?: number;
}

export type ParkingLotListResponse = ListResponse<ParkingLot>;
export type ParkingSpotListResponse = ListResponse<ParkingSpot>;
