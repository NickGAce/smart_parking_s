import type { UserRole } from '../types/common';

export const ALL_USER_ROLES: UserRole[] = ['admin', 'owner', 'tenant', 'guard', 'uk'];

export const MANAGEMENT_ROLES: UserRole[] = ['admin', 'owner'];

export const BOOKING_SELF_SERVICE_ROLES: UserRole[] = ['admin', 'owner', 'tenant'];

export const ANALYTICS_ANOMALY_FILTER_ROLES: UserRole[] = ['admin', 'owner', 'guard'];

export const ROLES_WITH_SPOT_CATALOG_ACCESS: UserRole[] = ['admin', 'owner', 'tenant', 'guard'];

export function hasRole(role: UserRole | undefined, allowedRoles: readonly UserRole[]): boolean {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}
