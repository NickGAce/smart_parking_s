import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { useBookingsQuery, useCheckInBookingMutation, useCheckOutBookingMutation, useMarkNoShowBookingMutation } from '../hooks';
import { bookingLifecycleErrorMessage } from '../error-messages';
import { bookingStatusMap } from '../../../shared/config/status-map';
import { StatusChip } from '../../../shared/ui/status-chip';

const operationalStatuses = ['confirmed', 'active'] as const;

export function GuardOperationalPanel() {
  const bookingsQuery = useBookingsQuery(
    {
      statuses: [...operationalStatuses],
      sort_by: 'start_time',
      sort_order: 'asc',
      limit: 20,
      offset: 0,
    },
    { refetchIntervalMs: 10_000 },
  );

  const checkInMutation = useCheckInBookingMutation();
  const checkOutMutation = useCheckOutBookingMutation();
  const markNoShowMutation = useMarkNoShowBookingMutation();

  const items = bookingsQuery.data?.items ?? [];
  const lifecycleError = checkInMutation.error ?? checkOutMutation.error ?? markNoShowMutation.error;
  const busy = checkInMutation.isPending || checkOutMutation.isPending || markNoShowMutation.isPending;

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">Операционная панель охраны</Typography>
        <Alert severity="info">
          Упрощённый режим: только актуальные бронирования и быстрые действия по статусу. Данные обновляются каждые 10 секунд.
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {operationalStatuses.map((status) => (
            <Chip key={status} label={`В работе: ${bookingStatusMap[status].label}`} size="small" color={bookingStatusMap[status].color} />
          ))}
        </Stack>

        {bookingsQuery.isError && <Alert severity="error">Не удалось загрузить актуальные брони для панели охраны.</Alert>}
        {lifecycleError && (
          <Alert severity="error">
            {bookingLifecycleErrorMessage(lifecycleError, 'Операция жизненного цикла отклонена сервером. Обновите список и попробуйте снова.')}
          </Alert>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Место</TableCell>
              <TableCell>Интервал</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="right">Быстрые действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((booking) => {
              const canCheckIn = ['confirmed', 'active'].includes(booking.status);
              const canCheckOut = booking.status === 'active';
              const canNoShow = ['confirmed', 'active'].includes(booking.status);

              return (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>{booking.parking_spot_id}</TableCell>
                  <TableCell>{new Date(booking.start_time).toLocaleString()} — {new Date(booking.end_time).toLocaleString()}</TableCell>
                  <TableCell><StatusChip status={booking.status} mapping={bookingStatusMap} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        disabled={!canCheckIn || busy}
                        onClick={() => checkInMutation.mutate(booking.id)}
                      >
                        Заезд
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={!canCheckOut || busy}
                        onClick={() => checkOutMutation.mutate(booking.id)}
                      >
                        Выезд
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={!canNoShow || busy}
                        onClick={() => markNoShowMutation.mutate(booking.id)}
                      >
                        Неявка
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    </Paper>
  );
}
