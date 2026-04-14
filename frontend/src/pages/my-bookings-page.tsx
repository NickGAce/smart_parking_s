import { Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { useMyBookingsQuery } from '../features/bookings/use-my-bookings-query';
import { PageState } from '../shared/ui/page-state';

export function MyBookingsPage() {
  const { data, isLoading, error } = useMyBookingsQuery();

  return (
    <>
      <Typography variant="h4" gutterBottom>My bookings</Typography>
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
                <TableCell>ID</TableCell><TableCell>Spot</TableCell><TableCell>Start</TableCell><TableCell>End</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>{booking.parking_spot_id}</TableCell>
                  <TableCell>{new Date(booking.start_time).toLocaleString()}</TableCell>
                  <TableCell>{new Date(booking.end_time).toLocaleString()}</TableCell>
                  <TableCell><Chip label={booking.status} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}
