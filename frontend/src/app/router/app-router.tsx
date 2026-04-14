import { CircularProgress, Stack } from '@mui/material';
import { Navigate, createBrowserRouter } from 'react-router-dom';

import { useAuth } from '../providers/auth-provider';
import { AppShell } from '../../widgets/layout/app-shell';
import { AdminUsersPage } from '../../pages/admin-users-page';
import { DashboardPage } from '../../pages/dashboard-page';
import { LoginPage } from '../../pages/login-page';
import { MyBookingsPage } from '../../pages/my-bookings-page';
import { NotFoundPage } from '../../pages/not-found-page';
import { NotificationsPage } from '../../pages/notifications-page';
import { ParkingLotsPage } from '../../pages/parking-lots-page';
import { ParkingSpotsPage } from '../../pages/parking-spots-page';
import { RegisterPage } from '../../pages/register-page';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Stack direction="row" justifyContent="center" py={6}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}

export const appRouter = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'parking/lots', element: <ParkingLotsPage /> },
      { path: 'parking/spots', element: <ParkingSpotsPage /> },
      { path: 'bookings/my', element: <MyBookingsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
