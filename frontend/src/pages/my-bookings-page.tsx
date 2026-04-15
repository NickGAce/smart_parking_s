import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BookingDetailsPanel } from '../features/bookings/components/booking-details-panel';
import { bookingStatuses } from '../features/bookings/constants';
import { useMyBookingsQuery } from '../features/bookings/hooks';
import { bookingStatusMap } from '../shared/config/status-map';
import { PageState } from '../shared/ui/page-state';
import { StatusChip } from '../shared/ui/status-chip';
import type { BookingStatus } from '../shared/types/common';
import type { BookingsQuery } from '../shared/types/booking';

function parseQuery(searchParams: URLSearchParams): Omit<BookingsQuery, 'mine'> {
  const statuses = searchParams.getAll('statuses') as BookingStatus[];

  return {
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    status: (searchParams.get('status') as BookingStatus) ?? undefined,
    statuses: statuses.length ? statuses : undefined,
    sort_by: 'start_time',
    sort_order: 'desc',
  };
}

function writeQuery(params: Omit<BookingsQuery, 'mine'>): URLSearchParams {
  const query = new URLSearchParams();

  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.status) query.set('status', params.status);
  (params.statuses ?? []).forEach((status) => query.append('statuses', status));

  return query;
}

export function MyBookingsPage() {
  const navigate = useNavigate();
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseQuery(searchParams), [searchParams]);

  const { data, isLoading, error } = useMyBookingsQuery(query);

  const updateStatuses = (status: BookingStatus, checked: boolean) => {
    const statuses = new Set(query.statuses ?? []);
    if (checked) {
      statuses.add(status);
    } else {
      statuses.delete(status);
    }

    setSearchParams(writeQuery({ ...query, statuses: Array.from(statuses) }));
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Alert severity="info">My bookings использует GET /bookings?mine=true с фильтрами по статусам и датам.</Alert>
        <Button variant="contained" onClick={() => navigate('/bookings/new')}>
          Создать бронирование
        </Button>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}><TextField label="from" type="datetime-local" size="small" fullWidth InputLabelProps={{ shrink: true }} value={query.from ?? ''} onChange={(e) => setSearchParams(writeQuery({ ...query, from: e.target.value || undefined }))} /></Grid>
          <Grid item xs={12} md={3}><TextField label="to" type="datetime-local" size="small" fullWidth InputLabelProps={{ shrink: true }} value={query.to ?? ''} onChange={(e) => setSearchParams(writeQuery({ ...query, to: e.target.value || undefined }))} /></Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="my-bookings-status">status</InputLabel>
              <Select labelId="my-bookings-status" label="status" value={query.status ?? ''} onChange={(e) => setSearchParams(writeQuery({ ...query, status: (e.target.value as BookingStatus) || undefined }))}>
                <MenuItem value="">all</MenuItem>
                {bookingStatuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button fullWidth variant="outlined" onClick={() => setSearchParams(writeQuery({ sort_by: 'start_time', sort_order: 'desc' }))}>Сбросить фильтры</Button>
          </Grid>
        </Grid>

        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
          {bookingStatuses.map((status) => (
            <FormControlLabel
              key={status}
              control={<Checkbox size="small" checked={(query.statuses ?? []).includes(status)} onChange={(e) => updateStatuses(status, e.target.checked)} />}
              label={`statuses[]: ${status}`}
            />
          ))}
        </Stack>
      </Paper>

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
                <TableCell>Interval</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>{booking.parking_spot_id}</TableCell>
                  <TableCell>{new Date(booking.start_time).toLocaleString()} — {new Date(booking.end_time).toLocaleString()}</TableCell>
                  <TableCell>
                    <StatusChip status={booking.status} mapping={bookingStatusMap} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => setSelectedBookingId(booking.id)}>Открыть</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <BookingDetailsPanel bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </Stack>
  );
}
