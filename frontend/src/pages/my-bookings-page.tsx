import { Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { useMyBookingsQuery } from '../features/bookings/use-my-bookings-query';
import { useNavigate } from 'react-router-dom';

import { bookingStatusMap } from '../shared/config/status-map';
import { PageState } from '../shared/ui/page-state';
import { StatusChip } from '../shared/ui/status-chip';

export function MyBookingsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useMyBookingsQuery();

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Button variant="contained" onClick={() => navigate('/bookings/new')}>
          Создать бронирование
        </Button>
      </Stack>
      <PageState
        isLoading={isLoading}
        errorText={error ? 'Не удалось загрузить бронирования.' : undefined}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        emptyText="У вас пока нет бронирований."
      />
      {data && data.items.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Spot</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>{booking.parking_spot_id}</TableCell>
                  <TableCell>{new Date(booking.start_time).toLocaleString()}</TableCell>
                  <TableCell>{new Date(booking.end_time).toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusChip status={booking.status} mapping={bookingStatusMap} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}
