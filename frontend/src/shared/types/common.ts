export type UserRole = 'admin' | 'owner' | 'tenant' | 'guard' | 'uk';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_show';

export type SpotRawStatus = 'available' | 'booked' | 'blocked';
export type SpotEffectiveStatus = 'available' | 'booked' | 'blocked';

export type SpotType = 'regular' | 'guest' | 'disabled' | 'ev' | 'reserved' | 'vip';
export type VehicleType = 'car' | 'bike' | 'truck';
export type SizeCategory = 'small' | 'medium' | 'large';

export type NotificationStatus = 'unread' | 'read';
export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_starts_soon'
  | 'booking_expired'
  | 'booking_no_show'
  | 'parking_rules_violation';

export type SortOrder = 'asc' | 'desc';

export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
}

export interface ListResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface FastApiValidationErrorItem {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface ApiErrorEnvelope {
  detail?: string | FastApiValidationErrorItem[];
}

export interface ApiError {
  message: string;
  status?: number;
  code: 'validation_error' | 'http_error' | 'network_error' | 'unknown_error';
  detail?: string;
  fieldErrors?: FastApiValidationErrorItem[];
  raw?: unknown;
}
