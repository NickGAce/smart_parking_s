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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { BookingDetailsPanel } from '../features/bookings/components/booking-details-panel';
import { GuardOperationalPanel } from '../features/bookings/components/guard-operational-panel';
import { bookingSortByOptions, bookingSortOrderOptions, bookingStatuses } from '../features/bookings/constants';
import { useBookingsQuery, useCheckInBookingMutation, useCheckOutBookingMutation, useMarkNoShowBookingMutation } from '../features/bookings/hooks';
import { bookingLifecycleErrorMessage } from '../features/bookings/error-messages';
import { useCurrentUser } from '../features/auth/use-current-user';
import { bookingStatusMap } from '../shared/config/status-map';
import { StatusChip } from '../shared/ui/status-chip';
import type { BookingStatus, SortOrder } from '../shared/types/common';
import type { BookingsQuery } from '../shared/types/booking';

const DEFAULT_LIMIT = 10;
const BACKEND_MAX_LIMIT = 100;

type SortBy = NonNullable<BookingsQuery['sort_by']>;

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBooleanParam = (value: string | null): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const normalizeLimit = (value: number | undefined): number => {
  if (!value || value <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(value, BACKEND_MAX_LIMIT);
};

function parseQuery(searchParams: URLSearchParams): BookingsQuery {
  const statuses = [...searchParams.getAll('statuses[]'), ...searchParams.getAll('statuses')] as BookingStatus[];

  return {
    parking_lot_id: parseNumberParam(searchParams.get('parking_lot_id')),
    parking_spot_id: parseNumberParam(searchParams.get('parking_spot_id')),
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    status: (searchParams.get('status') as BookingStatus) ?? undefined,
    statuses: statuses.length ? statuses : undefined,
    mine: parseBooleanParam(searchParams.get('mine')),
    limit: normalizeLimit(parseNumberParam(searchParams.get('limit'))),
    offset: parseNumberParam(searchParams.get('offset')) ?? 0,
    sort_by: (searchParams.get('sort_by') as SortBy) ?? 'start_time',
    sort_order: (searchParams.get('sort_order') as SortOrder) ?? 'desc',
  };
}

function writeQuery(params: BookingsQuery): URLSearchParams {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => query.append(key, String(entry)));
      return;
    }

    query.set(key, String(value));
  });

  return query;
}

export function BookingManagementPage() {
  const { role } = useCurrentUser();
  const isGuardView = role === 'guard';
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const query = useMemo(() => parseQuery(searchParams), [searchParams]);
  const requestQuery: BookingsQuery = useMemo(() => {
    if ((query.statuses?.length ?? 0) === 0) {
      return query;
    }

    return {
      ...query,
      offset: 0,
      limit: BACKEND_MAX_LIMIT,
    };
  }, [query]);

  const listQuery = useBookingsQuery(requestQuery, { refetchIntervalMs: 12_000 });
  const checkInMutation = useCheckInBookingMutation();
  const checkOutMutation = useCheckOutBookingMutation();
  const markNoShowMutation = useMarkNoShowBookingMutation();
  const isLifecyclePending = checkInMutation.isPending || checkOutMutation.isPending || markNoShowMutation.isPending;
  const lifecycleError = checkInMutation.error ?? checkOutMutation.error ?? markNoShowMutation.error;
  const filteredItems = useMemo(() => {
    const selectedStatuses = query.statuses ?? [];
    if (!listQuery.data || selectedStatuses.length === 0) {
      return listQuery.data?.items ?? [];
    }

    return listQuery.data.items.filter((booking) => selectedStatuses.includes(booking.status));
  }, [listQuery.data, query.statuses]);

  const visibleItems = useMemo(() => {
    if ((query.statuses?.length ?? 0) === 0) {
      return filteredItems;
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? DEFAULT_LIMIT;

    return filteredItems.slice(offset, offset + limit);
  }, [filteredItems, query.limit, query.offset, query.statuses]);

  const applyQuery = (patch: Partial<BookingsQuery>, resetOffset = false) => {
    const next: BookingsQuery = {
      ...query,
      ...patch,
      offset: resetOffset ? 0 : (patch.offset ?? query.offset ?? 0),
    };

    setSearchParams(writeQuery(next));
  };

  const updateStatuses = (status: BookingStatus, checked: boolean) => {
    const statuses = new Set(query.statuses ?? []);
    if (checked) statuses.add(status);
    else statuses.delete(status);
    applyQuery({ statuses: Array.from(statuses), status: undefined }, true);
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">Booking management: GET /bookings с фильтрами, сортировкой, pagination и панелью операций.</Alert>
      <Alert severity="warning">
        Статусы могут меняться фоново. После lifecycle операций UI всегда делает refetch деталей, списков и доступности мест.
      </Alert>

      {isGuardView && <GuardOperationalPanel />}

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}><TextField label="parking_lot_id" type="number" size="small" fullWidth value={query.parking_lot_id ?? ''} onChange={(e) => applyQuery({ parking_lot_id: e.target.value ? Number(e.target.value) : undefined }, true)} disabled={isGuardView} /></Grid>
          <Grid item xs={12} md={2}><TextField label="parking_spot_id" type="number" size="small" fullWidth value={query.parking_spot_id ?? ''} onChange={(e) => applyQuery({ parking_spot_id: e.target.value ? Number(e.target.value) : undefined }, true)} disabled={isGuardView} /></Grid>
          <Grid item xs={12} md={2}><TextField label="from" type="datetime-local" size="small" fullWidth InputLabelProps={{ shrink: true }} value={query.from ?? ''} onChange={(e) => applyQuery({ from: e.target.value || undefined }, true)} disabled={isGuardView} /></Grid>
          <Grid item xs={12} md={2}><TextField label="to" type="datetime-local" size="small" fullWidth InputLabelProps={{ shrink: true }} value={query.to ?? ''} onChange={(e) => applyQuery({ to: e.target.value || undefined }, true)} disabled={isGuardView} /></Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="booking-status">status</InputLabel>
              <Select labelId="booking-status" label="status" value={query.status ?? ''} onChange={(e) => applyQuery({ status: (e.target.value as BookingStatus) || undefined, statuses: undefined }, true)} disabled={isGuardView}>
                <MenuItem value="">all</MenuItem>
                {bookingStatuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="booking-mine">mine</InputLabel>
              <Select labelId="booking-mine" label="mine" value={query.mine === undefined ? '' : String(query.mine)} onChange={(e) => applyQuery({ mine: parseBooleanParam(e.target.value || null) }, true)} disabled={isGuardView}>
                <MenuItem value="">all</MenuItem>
                <MenuItem value="true">true</MenuItem>
                <MenuItem value="false">false</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="booking-sort-by">sort_by</InputLabel>
              <Select labelId="booking-sort-by" label="sort_by" value={query.sort_by ?? 'start_time'} onChange={(e) => applyQuery({ sort_by: e.target.value as SortBy }, true)} disabled={isGuardView}>
                {bookingSortByOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="booking-sort-order">sort_order</InputLabel>
              <Select labelId="booking-sort-order" label="sort_order" value={query.sort_order ?? 'desc'} onChange={(e) => applyQuery({ sort_order: e.target.value as SortOrder }, true)} disabled={isGuardView}>
                {bookingSortOrderOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}><Button fullWidth variant="outlined" onClick={() => setSearchParams(writeQuery({ limit: DEFAULT_LIMIT, offset: 0, sort_by: 'start_time', sort_order: 'desc' }))} disabled={isGuardView}>Сбросить</Button></Grid>
        </Grid>

        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
          {bookingStatuses.map((status) => (
            <FormControlLabel
              key={status}
              control={<Checkbox size="small" checked={(query.statuses ?? []).includes(status)} onChange={(e) => updateStatuses(status, e.target.checked)} disabled={isGuardView} />}
              label={`statuses: ${status}`}
            />
          ))}
        </Stack>
      </Paper>

      {lifecycleError && (
        <Alert severity="error">
          {bookingLifecycleErrorMessage(lifecycleError, 'Lifecycle операция отклонена backend. Статус мог измениться в фоне.')}
        </Alert>
      )}
      {(checkInMutation.isSuccess || checkOutMutation.isSuccess || markNoShowMutation.isSuccess) && (
        <Alert severity="success">Lifecycle-операция выполнена. Данные в таблице уже обновлены.</Alert>
      )}

      {listQuery.isError && (
        <Alert severity="error">Не удалось загрузить бронирования для management-экрана.</Alert>
      )}

      {listQuery.data && visibleItems.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Spot</TableCell>
                <TableCell>Interval</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleItems.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>{booking.id}</TableCell>
                  <TableCell>{booking.user_id}</TableCell>
                  <TableCell>{booking.parking_spot_id}</TableCell>
                  <TableCell>{new Date(booking.start_time).toLocaleString()} — {new Date(booking.end_time).toLocaleString()}</TableCell>
                  <TableCell><StatusChip status={booking.status} mapping={bookingStatusMap} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => setSelectedBookingId(booking.id)}>Details / Ops</Button>
                      <Button size="small" color="success" variant="contained" disabled={isLifecyclePending || !['confirmed', 'active'].includes(booking.status)} onClick={() => checkInMutation.mutate(booking.id)}>Check-in</Button>
                      <Button size="small" color="primary" variant="contained" disabled={isLifecyclePending || booking.status !== 'active'} onClick={() => checkOutMutation.mutate(booking.id)}>Check-out</Button>
                      <Button size="small" color="warning" variant="outlined" disabled={isLifecyclePending || !['confirmed', 'active'].includes(booking.status)} onClick={() => markNoShowMutation.mutate(booking.id)}>No-show</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={(query.statuses?.length ?? 0) > 0 ? filteredItems.length : listQuery.data.meta.total}
            page={Math.floor((query.offset ?? 0) / (query.limit ?? DEFAULT_LIMIT))}
            rowsPerPage={query.limit ?? DEFAULT_LIMIT}
            onPageChange={(_, page) => applyQuery({ offset: page * (query.limit ?? DEFAULT_LIMIT) })}
            onRowsPerPageChange={(e) => applyQuery({ limit: Number(e.target.value), offset: 0 })}
            rowsPerPageOptions={[5, 10, 20, 50]}
          />
        </Paper>
      )}
      {listQuery.data && visibleItems.length === 0 && (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6">Бронирования не найдены</Typography>
          <Typography color="text.secondary">
            Измените фильтры, период или статус, чтобы увидеть данные для управления lifecycle.
          </Typography>
        </Paper>
      )}

      <BookingDetailsPanel bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </Stack>
  );
}
