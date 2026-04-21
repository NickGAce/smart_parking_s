import { Button, Stack, Typography } from '@mui/material';
import { Navigate, Link as RouterLink } from 'react-router-dom';

import { useAuth } from '../features/auth/use-auth';
import { DataListPageTemplate } from '../shared/ui/page-templates';

const OPERATIONS_ROLES = new Set(['admin', 'owner', 'guard']);

export function BookingsPage() {
  const { user } = useAuth();

  if (user) {
    const redirectTo = OPERATIONS_ROLES.has(user.role) ? '/booking-management' : '/my-bookings';

    return <Navigate to={redirectTo} replace />;
  }

  return (
    <DataListPageTemplate
      headerMeta="служебный маршрут"
      title="Бронирования"
      subtitle="Маршрут /bookings перенаправляет на актуальные экраны бронирований."
      isEmpty
      emptyText="Выберите нужный сценарий"
      dataView={null}
      stateSx={{ p: { xs: 3, md: 4 } }}
      topBanner={(
        <Stack spacing={1}>
          <Typography color="text.secondary">
            Для арендаторов доступна страница «Мои бронирования», для операционных ролей — «Управление бронированиями».
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={RouterLink} to="/my-bookings" variant="outlined">Мои бронирования</Button>
            <Button component={RouterLink} to="/booking-management" variant="contained">Управление бронированиями</Button>
          </Stack>
        </Stack>
      )}
    />
  );
}
