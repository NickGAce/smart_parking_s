import { Navigate, createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '../layouts/app-layout';
import { AppShell, DEFAULT_ROLE_ROUTE } from '../../widgets/layout/app-shell';
import { useAuth } from '../../features/auth/use-auth';
import { AdminPage } from '../../pages/admin-page';
import { AnalyticsPage } from '../../pages/analytics-page';
import { BookingsPage } from '../../pages/bookings-page';
import { DashboardPage } from '../../pages/dashboard-page';
import { LoginPage } from '../../pages/login-page';
import { NotFoundPage } from '../../pages/not-found-page';
import { NotificationsPage } from '../../pages/notifications-page';
import { ParkingLotsPage } from '../../pages/parking-lots-page';
import { ParkingSpotsPage } from '../../pages/parking-spots-page';
import { RegisterPage } from '../../pages/register-page';
import { PublicOnlyRoute, RequireAuth, RequireRoleAccess } from './route-guards';

function RoleHomeRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={DEFAULT_ROLE_ROUTE[user.role]} replace />;
}

export const appRouter = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRoleAccess />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <RoleHomeRedirect /> },
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/parking-lots', element: <ParkingLotsPage /> },
              { path: '/parking-spots', element: <ParkingSpotsPage /> },
              { path: '/bookings', element: <BookingsPage /> },
              { path: '/notifications', element: <NotificationsPage /> },
              { path: '/analytics', element: <AnalyticsPage /> },
              { path: '/admin', element: <AdminPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
