import type { UserRole } from '../../shared/types/common';

export const defaultRoleRoute: Record<UserRole, string> = {
  admin: '/dashboard',
  owner: '/dashboard',
  tenant: '/my-bookings',
  guard: '/booking-management',
  uk: '/dashboard',
};

export const DEFAULT_ROLE_ROUTE = defaultRoleRoute;
