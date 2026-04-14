import { CircularProgress, Stack, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../features/auth/use-auth';
import type { UserRole } from '../../shared/types/common';

export const DEFAULT_ROLE_ROUTE: Record<UserRole, string> = {
  admin: '/admin',
  owner: '/dashboard',
  tenant: '/bookings',
  guard: '/parking-spots',
  uk: '/dashboard',
};

const ROLE_ALLOWED_PATHS: Record<UserRole, string[]> = {
  admin: ['/dashboard', '/parking-lots', '/parking-spots', '/bookings', '/notifications', '/analytics', '/admin'],
  owner: ['/dashboard', '/parking-lots', '/parking-spots', '/bookings', '/notifications', '/analytics'],
  tenant: ['/dashboard', '/bookings', '/notifications'],
  guard: ['/dashboard', '/parking-spots', '/notifications'],
  uk: ['/dashboard', '/notifications'],
};

function FullscreenLoader() {
  return (
    <Stack alignItems="center" justifyContent="center" minHeight="100vh" spacing={2}>
      <CircularProgress />
      <Typography color="text.secondary">Проверка сессии...</Typography>
    </Stack>
  );
}

export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <FullscreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <FullscreenLoader />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={DEFAULT_ROLE_ROUTE[user.role]} replace />;
  }

  return <Outlet />;
}

export function RequireRoleAccess() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAllowed = ROLE_ALLOWED_PATHS[user.role].some((pathPrefix) => location.pathname.startsWith(pathPrefix));

  if (!isAllowed) {
    return <Navigate to={DEFAULT_ROLE_ROUTE[user.role]} replace />;
  }

  return <Outlet />;
}

export const roleAllowedPaths = ROLE_ALLOWED_PATHS;
