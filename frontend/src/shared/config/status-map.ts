import type { BookingStatus, NotificationStatus, SpotEffectiveStatus } from '../types/common';

type StatusColor = 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';

export interface StatusMeta {
  label: string;
  color: StatusColor;
}

export const bookingStatusMap: Record<BookingStatus, StatusMeta> = {
  pending: { label: 'Pending', color: 'warning' },
  confirmed: { label: 'Confirmed', color: 'info' },
  active: { label: 'Active', color: 'primary' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'default' },
  expired: { label: 'Expired', color: 'error' },
  no_show: { label: 'No show', color: 'error' },
};

export const effectiveStatusMap: Record<SpotEffectiveStatus, StatusMeta> = {
  available: { label: 'Available', color: 'success' },
  booked: { label: 'Booked', color: 'warning' },
  blocked: { label: 'Blocked', color: 'error' },
};

export const notificationStatusMap: Record<NotificationStatus, StatusMeta> = {
  unread: { label: 'Unread', color: 'info' },
  read: { label: 'Read', color: 'default' },
};
