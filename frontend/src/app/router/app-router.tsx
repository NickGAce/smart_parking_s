/* eslint-disable react-refresh/only-export-components */
import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '../layouts/app-layout';
import { AppShell } from '../../widgets/layout/app-shell';
import { useAuth } from '../../features/auth/use-auth';
import { NotFoundPage } from '../../pages/not-found-page';
import { PublicOnlyRoute, RequireAuth, RequireRole } from './route-guards';
import { defaultRoleRoute } from './role-routes';
import { routeConfig } from './route-config';

function RoleHomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={defaultRoleRoute[user.role]} replace />;
}

const publicRoutes = routeConfig.filter((route) => route.isPublic);
const protectedRoutes = routeConfig.filter((route) => !route.isPublic);

export const appRouter = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AppLayout />,
        children: publicRoutes.map((route) => ({
          path: route.path,
          element: <route.component />,
        })),
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <RoleHomeRedirect /> },
          ...protectedRoutes.map((route) => ({
            element: <RequireRole allowedRoles={route.roles ?? []} />,
            children: [{ path: route.path, element: <route.component /> }],
          })),
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
