import type { SizeCategory, SortOrder, SpotRawStatus, SpotType, VehicleType } from '../../shared/types/common';
import type { ParkingSpotsQuery } from '../../shared/types/parking';

// Temporary frontend constants until dedicated reference-data endpoints are available.
export const parkingSpotSortByOptions: Array<NonNullable<ParkingSpotsQuery['sort_by']>> = [
  'id',
  'spot_number',
  'status',
  'spot_type',
  'vehicle_type',
  'size_category',
];

export const parkingSpotSortOrderOptions: SortOrder[] = ['asc', 'desc'];
export const parkingSpotTypeOptions: SpotType[] = ['regular', 'guest', 'disabled', 'ev', 'reserved', 'vip'];
export const parkingSpotVehicleTypeOptions: VehicleType[] = ['car', 'bike', 'truck'];
export const parkingSpotSizeCategoryOptions: SizeCategory[] = ['small', 'medium', 'large'];
export const parkingSpotRawStatusOptions: SpotRawStatus[] = ['available', 'booked', 'blocked'];

export const parkingSpotRawStatusLabels: Record<SpotRawStatus, string> = {
  available: 'Available (raw)',
  booked: 'Booked (raw)',
  blocked: 'Blocked (raw)',
};
