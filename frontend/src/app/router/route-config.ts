import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { matchPath } from 'react-router-dom';

import { DashboardPage } from '../../pages/dashboard-page';
import { ForbiddenPage } from '../../pages/forbidden-page';
import { LoginPage } from '../../pages/login-page';
import { ParkingLotsPage } from '../../pages/parking-lots-page';
import { RegisterPage } from '../../pages/register-page';
import { ALL_USER_ROLES, ROLES_WITH_SPOT_CATALOG_ACCESS } from '../../shared/config/roles';
import type { UserRole } from '../../shared/types/common';

function lazyNamed<T extends ComponentType>(loader: () => Promise<Record<string, unknown>>, exportName: string) {
  return lazy(async () => ({ default: (await loader())[exportName] as T }));
}

const AnalyticsPage = lazyNamed(() => import('../../pages/analytics-page'), 'AnalyticsPage');
const AuditLogsPage = lazyNamed(() => import('../../pages/audit-logs-page'), 'AuditLogsPage');
const BookingManagementPage = lazyNamed(() => import('../../pages/booking-management-page'), 'BookingManagementPage');
const CreateBookingPage = lazyNamed(() => import('../../pages/create-booking-page'), 'CreateBookingPage');
const MyBookingsPage = lazyNamed(() => import('../../pages/my-bookings-page'), 'MyBookingsPage');
const NotificationsPage = lazyNamed(() => import('../../pages/notifications-page'), 'NotificationsPage');
const ParkingLotDetailsPage = lazyNamed(() => import('../../pages/parking-lot-details-page'), 'ParkingLotDetailsPage');
const ParkingSpotsPage = lazyNamed(() => import('../../pages/parking-spots-page'), 'ParkingSpotsPage');
const AdminUsersPage = lazyNamed(() => import('../../pages/admin-users-page'), 'AdminUsersPage');

const AdminPage = lazyNamed(() => import('../../pages/admin-page'), 'AdminPage');
const BookingsPage = lazyNamed(() => import('../../pages/bookings-page'), 'BookingsPage');
const HomePage = lazyNamed(() => import('../../pages/home-page'), 'HomePage');

export interface AppRouteConfig {
  path: string;
  title: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
  isPublic?: boolean;
  menuLabel?: string;
  roles?: UserRole[];
  showInMenu?: boolean;
}

export const routeConfig: AppRouteConfig[] = [
  { path: '/login', title: 'Вход в систему', component: LoginPage, isPublic: true },
  { path: '/register', title: 'Регистрация', component: RegisterPage, isPublic: true },
  { path: '/home', title: 'Главная', component: HomePage, isPublic: true, showInMenu: false },
  { path: '/403', title: 'Доступ запрещен', component: ForbiddenPage },
  {
    path: '/dashboard',
    title: 'Панель управления',
    component: DashboardPage,
    menuLabel: 'Панель управления',
    roles: ALL_USER_ROLES,
    showInMenu: true,
  },
  {
    path: '/parking-lots',
    title: 'Парковки',
    component: ParkingLotsPage,
    menuLabel: 'Парковки',
    roles: ALL_USER_ROLES,
    showInMenu: true,
  },
  {
    path: '/parking-lots/:lotId',
    title: 'Детали парковки',
    component: ParkingLotDetailsPage,
    roles: ALL_USER_ROLES,
    showInMenu: false,
  },
  {
    path: '/parking-spots',
    title: 'Парковочные места',
    component: ParkingSpotsPage,
    menuLabel: 'Парковочные места',
    roles: ROLES_WITH_SPOT_CATALOG_ACCESS,
    showInMenu: true,
  },
  {
    path: '/bookings',
    title: 'Бронирования',
    component: BookingsPage,
    roles: ALL_USER_ROLES,
    showInMenu: false,
  },
  {
    path: '/my-bookings',
    title: 'Мои бронирования',
    component: MyBookingsPage,
    menuLabel: 'Мои бронирования',
    roles: ALL_USER_ROLES,
    showInMenu: true,
  },

  {
    path: '/bookings/new',
    title: 'Создание бронирования',
    component: CreateBookingPage,
    menuLabel: 'Новое бронирование',
    roles: ALL_USER_ROLES,
    showInMenu: true,
  },
  {
    path: '/booking-management',
    title: 'Управление бронированиями',
    component: BookingManagementPage,
    menuLabel: 'Управление бронированиями',
    roles: ['admin', 'owner', 'guard'],
    showInMenu: true,
  },
  {
    path: '/notifications',
    title: 'Уведомления',
    component: NotificationsPage,
    menuLabel: 'Уведомления',
    roles: ALL_USER_ROLES,
    showInMenu: true,
  },
  {
    path: '/analytics',
    title: 'Аналитика',
    component: AnalyticsPage,
    menuLabel: 'Аналитика',
    roles: ['admin', 'owner', 'tenant'],
    showInMenu: true,
  },
  {
    path: '/admin',
    title: 'Администрирование',
    component: AdminPage,
    roles: ['admin'],
    showInMenu: false,
  },
  {
    path: '/admin-users',
    title: 'Пользователи и роли',
    component: AdminUsersPage,
    menuLabel: 'Пользователи',
    roles: ['admin'],
    showInMenu: true,
  },
  {
    path: '/audit-logs',
    title: 'Журнал аудита',
    component: AuditLogsPage,
    menuLabel: 'Журнал аудита',
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
