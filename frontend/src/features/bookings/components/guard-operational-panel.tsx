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
        <Typography variant="h6">Guard operational panel</Typography>
        <Alert severity="info">
          Упрощённый view: только актуальные брони и быстрые lifecycle действия. Данные автообновляются каждые 10 секунд.
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {operationalStatuses.map((status) => (
            <Chip key={status} label={`В работе: ${bookingStatusMap[status].label}`} size="small" color={bookingStatusMap[status].color} />
          ))}
        </Stack>

        {bookingsQuery.isError && <Alert severity="error">Не удалось загрузить актуальные брони для guard панели.</Alert>}
        {lifecycleError && (
          <Alert severity="error">
            {bookingLifecycleErrorMessage(lifecycleError, 'Lifecycle операция отклонена backend. Обновите список и попробуйте снова.')}
          </Alert>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Spot</TableCell>
              <TableCell>Interval</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Quick actions</TableCell>
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
                        Check-in
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        disabled={!canCheckOut || busy}
                        onClick={() => checkOutMutation.mutate(booking.id)}
                      >
                        Check-out
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={!canNoShow || busy}
                        onClick={() => markNoShowMutation.mutate(booking.id)}
                      >
                        No-show
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
