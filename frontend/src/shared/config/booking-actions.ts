import type { BookingStatus, UserRole } from '../types/common';

export type BookingAction = 'open_details' | 'edit' | 'change_status' | 'cancel';

const terminalStatuses: BookingStatus[] = ['completed', 'cancelled', 'expired', 'no_show'];

export function canCancelBooking(status: BookingStatus, role?: UserRole): boolean {
  if (!role) {
    return false;
  }

  if (!['admin', 'owner', 'tenant'].includes(role)) {
    return false;
  }

  return !terminalStatuses.includes(status);
}

export function canEditBooking(status: BookingStatus, role?: UserRole): boolean {
  if (!role) {
    return false;
  }

  if (!['admin', 'owner', 'tenant'].includes(role)) {
    return false;
  }

  return ['pending', 'confirmed'].includes(status);
}

export function canChangeStatus(status: BookingStatus, role?: UserRole): boolean {
  if (!role) {
    return false;
  }

  if (role !== 'admin' && role !== 'owner') {
    return false;
  }

  return !terminalStatuses.includes(status);
}

export function getAvailableBookingActions(status: BookingStatus, role?: UserRole): BookingAction[] {
  const actions: BookingAction[] = ['open_details'];

  if (canEditBooking(status, role)) {
    actions.push('edit');
  }

  if (canChangeStatus(status, role)) {
    actions.push('change_status');
  }

  if (canCancelBooking(status, role)) {
    actions.push('cancel');
  }

  return actions;
}

export const bookingActionAvailabilityMap: Record<BookingStatus, BookingAction[]> = {
  pending: ['open_details', 'edit', 'change_status', 'cancel'],
  confirmed: ['open_details', 'edit', 'change_status', 'cancel'],
  active: ['open_details', 'change_status', 'cancel'],
  completed: ['open_details'],
  cancelled: ['open_details'],
  expired: ['open_details'],
  no_show: ['open_details'],
};
