import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../features/auth/use-auth';
import { DEFAULT_ROLE_ROUTE, defaultRoleRoute } from './role-routes';
import type { UserRole } from '../../shared/types/common';
import { LoadingState } from '../../shared/ui/loading-state';

function FullscreenLoader() {
  return <LoadingState message="Проверка сессии..." fullScreen />;
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

export function RequireRole({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles.length === 0 || allowedRoles.includes(user.role)) {
    return <Outlet />;
  }

  return <Navigate to={defaultRoleRoute[user.role]} replace />;
}
