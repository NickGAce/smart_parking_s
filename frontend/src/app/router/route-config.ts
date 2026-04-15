import type { ComponentType } from 'react';
import { matchPath } from 'react-router-dom';

import { AdminUsersPage } from '../../pages/admin-users-page';
import { AnalyticsPage } from '../../pages/analytics-page';
import { AuditLogsPage } from '../../pages/audit-logs-page';
import { BookingManagementPage } from '../../pages/booking-management-page';
import { CreateBookingPage } from '../../pages/create-booking-page';
import { DashboardPage } from '../../pages/dashboard-page';
import { ForbiddenPage } from '../../pages/forbidden-page';
import { LoginPage } from '../../pages/login-page';
import { MyBookingsPage } from '../../pages/my-bookings-page';
import { NotificationsPage } from '../../pages/notifications-page';
import { ParkingLotDetailsPage } from '../../pages/parking-lot-details-page';
import { ParkingLotsPage } from '../../pages/parking-lots-page';
import { ParkingSpotsPage } from '../../pages/parking-spots-page';
import { RegisterPage } from '../../pages/register-page';
import type { UserRole } from '../../shared/types/common';

export interface AppRouteConfig {
  path: string;
  title: string;
  component: ComponentType;
  isPublic?: boolean;
  menuLabel?: string;
  roles?: UserRole[];
  showInMenu?: boolean;
}

export const routeConfig: AppRouteConfig[] = [
  { path: '/login', title: 'Login', component: LoginPage, isPublic: true },
  { path: '/register', title: 'Register', component: RegisterPage, isPublic: true },
  { path: '/403', title: 'Forbidden', component: ForbiddenPage },
  {
    path: '/dashboard',
    title: 'Dashboard',
    component: DashboardPage,
    menuLabel: 'Dashboard',
    roles: ['admin', 'owner', 'tenant', 'guard', 'uk'],
    showInMenu: true,
  },
  {
    path: '/parking-lots',
    title: 'Parking lots',
    component: ParkingLotsPage,
    menuLabel: 'Parking lots',
    roles: ['admin', 'owner', 'tenant', 'guard', 'uk'],
    showInMenu: true,
  },
  {
    path: '/parking-lots/:lotId',
    title: 'Parking lot details',
    component: ParkingLotDetailsPage,
    roles: ['admin', 'owner', 'tenant', 'guard', 'uk'],
    showInMenu: false,
  },
  {
    path: '/parking-spots',
    title: 'Parking spots',
    component: ParkingSpotsPage,
    menuLabel: 'Parking spots',
    roles: ['admin', 'owner', 'tenant', 'guard'],
    showInMenu: true,
  },
  {
    path: '/my-bookings',
    title: 'My bookings',
    component: MyBookingsPage,
    menuLabel: 'My bookings',
    roles: ['admin', 'owner', 'tenant', 'guard', 'uk'],
    showInMenu: true,
  },

  {
    path: '/bookings/new',
    title: 'Create booking',
    component: CreateBookingPage,
    menuLabel: 'Create booking',
    roles: ['admin', 'owner', 'tenant', 'guard', 'uk'],
    showInMenu: true,
  },
  {
    path: '/booking-management',
    title: 'Booking management',
    component: BookingManagementPage,
    menuLabel: 'Booking management',
    roles: ['admin', 'owner', 'guard'],
    showInMenu: true,
  },
  {
    path: '/notifications',
    title: 'Notifications',
    component: NotificationsPage,
    menuLabel: 'Notifications',
    roles: ['admin', 'owner', 'tenant', 'guard', 'uk'],
    showInMenu: true,
  },
  {
    path: '/analytics',
    title: 'Analytics',
    component: AnalyticsPage,
    menuLabel: 'Analytics',
    roles: ['admin', 'owner', 'tenant'],
    showInMenu: true,
  },
  {
    path: '/admin-users',
    title: 'Admin users',
    component: AdminUsersPage,
    menuLabel: 'Admin users',
    roles: ['admin'],
    showInMenu: true,
  },
  {
    path: '/audit-logs',
    title: 'Audit logs',
    component: AuditLogsPage,
    menuLabel: 'Audit logs',
    roles: ['admin'],
    showInMenu: true,
  },
];

export function getMenuByRole(role: UserRole) {
  return routeConfig.filter((route) => route.showInMenu && route.menuLabel && route.roles?.includes(role));
}

export function findRouteByPathname(pathname: string) {
  return routeConfig.find((route) => matchPath({ path: route.path, end: true }, pathname));
}
