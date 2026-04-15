import { CircularProgress, Stack, Typography } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../features/auth/use-auth';
import { defaultRoleRoute } from './route-config';
import type { UserRole } from '../../shared/types/common';

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
    return <Navigate to={defaultRoleRoute[user.role]} replace />;
  }

  return <Outlet />;
}

export function RequireRole({ allowedRoles }: { allowedRoles?: UserRole[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles || allowedRoles.includes(user.role)) {
    return <Outlet />;
  }

  return <Navigate to="/403" replace />;
}

export const DEFAULT_ROLE_ROUTE = defaultRoleRoute;
export { defaultRoleRoute };
