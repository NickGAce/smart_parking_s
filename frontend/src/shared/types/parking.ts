import type { PaginatedResponse, UserRole } from './common';

export type AccessMode = 'employees_only' | 'guests_only' | 'mixed';
export type SpotEffectiveStatus = 'available' | 'booked' | 'blocked';

export interface ParkingLot {
  id: number;
  name: string;
  address?: string | null;
  access_mode: AccessMode;
  allowed_user_roles: UserRole[];
}

export interface ParkingSpot {
  id: number;
  spot_number: string;
  parking_lot_id: number;
  spot_type: 'regular' | 'guest' | 'disabled' | 'ev' | 'reserved' | 'vip';
  vehicle_type: 'car' | 'bike' | 'truck';
  status: SpotEffectiveStatus;
  effective_status: SpotEffectiveStatus;
  zone_name?: string | null;
  has_charger: boolean;
}

export type ParkingLotListResponse = PaginatedResponse<ParkingLot>;
export type ParkingSpotListResponse = PaginatedResponse<ParkingSpot>;
