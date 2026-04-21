import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableContainer,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { BookingDetailsPanel } from '../features/bookings/components/booking-details-panel';
import { GuardOperationalPanel } from '../features/bookings/components/guard-operational-panel';
import { bookingSortByOptions, bookingSortOrderOptions, bookingStatuses } from '../features/bookings/constants';
import { bookingLifecycleErrorMessage } from '../features/bookings/error-messages';
import { useBookingsQuery, useCheckInBookingMutation, useCheckOutBookingMutation, useMarkNoShowBookingMutation } from '../features/bookings/hooks';
import {
  bookingSortByLabelMap,
  bookingSortOrderLabelMap,
  bookingStatusLabelMap,
  formatBookingDurationLabel,
  formatBookingInterval,
} from '../shared/config/booking-ui';
import { bookingStatusMap } from '../shared/config/status-map';
import { ContentCard } from '../shared/ui/content-card';
import { FiltersSection } from '../shared/ui/filters-section';
import { DataListPageTemplate } from '../shared/ui/page-templates';
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

  const activeStatuses = query.statuses ?? [];

  return (
    <>
      <DataListPageTemplate
        title="Управление бронированиями"
        subtitle="Операционный экран для контроля статусов, интервалов и действий по жизненному циклу бронирований."
        headerMeta="Операционные действия"
        topBanner={(
          <Stack spacing={1.5}>
            <Alert severity="info">Фильтры помогают быстро найти конфликтные или срочные бронирования по времени и статусам.</Alert>
            <Alert severity="warning">Статус может измениться в фоне. После операции список и детали автоматически обновляются.</Alert>
            {isGuardView && <GuardOperationalPanel />}
            {lifecycleError && (
              <Alert severity="error">
                {bookingLifecycleErrorMessage(lifecycleError, 'Операция не выполнена. Обновите данные и проверьте текущий статус бронирования.')}
              </Alert>
            )}
            {(checkInMutation.isSuccess || checkOutMutation.isSuccess || markNoShowMutation.isSuccess) && (
              <Alert severity="success">Операция применена. Данные в таблице синхронизированы.</Alert>
            )}
          </Stack>
        )}
        filters={(
          <FiltersSection
            onReset={() => setSearchParams(writeQuery({ limit: DEFAULT_LIMIT, offset: 0, sort_by: 'start_time', sort_order: 'desc' }))}
            resetLabel="Сбросить"
          >
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="ID парковки"
                    type="number"
                    size="small"
                    fullWidth
                    value={query.parking_lot_id ?? ''}
                    onChange={(e) => applyQuery({ parking_lot_id: e.target.value ? Number(e.target.value) : undefined }, true)}
                    disabled={isGuardView}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="ID места"
                    type="number"
                    size="small"
                    fullWidth
                    value={query.parking_spot_id ?? ''}
                    onChange={(e) => applyQuery({ parking_spot_id: e.target.value ? Number(e.target.value) : undefined }, true)}
                    disabled={isGuardView}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Начало периода"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={query.from ?? ''}
                    onChange={(e) => applyQuery({ from: e.target.value || undefined }, true)}
                    disabled={isGuardView}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Окончание периода"
                    type="datetime-local"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    value={query.to ?? ''}
                    onChange={(e) => applyQuery({ to: e.target.value || undefined }, true)}
                    disabled={isGuardView}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small" disabled={isGuardView}>
                    <InputLabel id="booking-status">Статус</InputLabel>
                    <Select
                      labelId="booking-status"
                      label="Статус"
                      value={query.status ?? ''}
                      onChange={(e) => applyQuery({ status: (e.target.value as BookingStatus) || undefined, statuses: undefined }, true)}
                    >
                      <MenuItem value="">Все статусы</MenuItem>
                      {bookingStatuses.map((status) => <MenuItem key={status} value={status}>{bookingStatusLabelMap[status]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small" disabled={isGuardView}>
                    <InputLabel id="booking-mine">Принадлежность</InputLabel>
                    <Select
                      labelId="booking-mine"
                      label="Принадлежность"
                      value={query.mine === undefined ? '' : String(query.mine)}
                      onChange={(e) => applyQuery({ mine: parseBooleanParam(e.target.value || null) }, true)}
                    >
                      <MenuItem value="">Все</MenuItem>
                      <MenuItem value="true">Только мои</MenuItem>
                      <MenuItem value="false">Чужие</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small" disabled={isGuardView}>
                    <InputLabel id="booking-sort-by">Сортировка</InputLabel>
                    <Select
                      labelId="booking-sort-by"
                      label="Сортировка"
                      value={query.sort_by ?? 'start_time'}
                      onChange={(e) => applyQuery({ sort_by: e.target.value as SortBy }, true)}
                    >
                      {bookingSortByOptions.map((item) => <MenuItem key={item} value={item}>{bookingSortByLabelMap[item]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small" disabled={isGuardView}>
                    <InputLabel id="booking-sort-order">Порядок</InputLabel>
                    <Select
                      labelId="booking-sort-order"
                      label="Порядок"
                      value={query.sort_order ?? 'desc'}
                      onChange={(e) => applyQuery({ sort_order: e.target.value as SortOrder }, true)}
                    >
                      {bookingSortOrderOptions.map((item) => <MenuItem key={item} value={item}>{bookingSortOrderLabelMap[item]}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {bookingStatuses.map((status) => (
                  <FormControlLabel
                    key={status}
                    control={<Switch size="small" checked={activeStatuses.includes(status)} onChange={(e) => updateStatuses(status, e.target.checked)} disabled={isGuardView} />}
                    label={bookingStatusLabelMap[status]}
                  />
                ))}
              </Stack>
            </Stack>
          </FiltersSection>
        )}
        isLoading={listQuery.isLoading}
        errorText={listQuery.isError ? 'Не удалось загрузить бронирования для управления.' : undefined}
        isEmpty={!listQuery.isLoading && !listQuery.isError && visibleItems.length === 0}
        emptyText="Бронирования по выбранным фильтрам не найдены."
        dataView={(
          <ContentCard padded={false}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table aria-label="Таблица управления бронированиями" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell scope="col">Бронь</TableCell>
                    <TableCell scope="col">Пользователь</TableCell>
                    <TableCell scope="col">Статус</TableCell>
                    <TableCell scope="col">Интервал</TableCell>
                    <TableCell scope="col">Длительность</TableCell>
                    <TableCell scope="col" align="right">Операции</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleItems.map((booking) => (
                    <TableRow key={booking.id} hover>
                      <TableCell component="th" scope="row">
                        <Stack spacing={0.5}>
                          <Typography variant="subtitle2">#{booking.id}</Typography>
                          <Typography variant="caption" color="text.secondary">Место #{booking.parking_spot_id}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{booking.user_id}</TableCell>
                      <TableCell><StatusChip status={booking.status} mapping={bookingStatusMap} /></TableCell>
                      <TableCell>{formatBookingInterval(booking.start_time, booking.end_time)}</TableCell>
                      <TableCell>{formatBookingDurationLabel(booking.start_time, booking.end_time)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            startIcon={<VisibilityOutlinedIcon />}
                            onClick={() => setSelectedBookingId(booking.id)}
                            aria-label={`Открыть детали бронирования №${booking.id}`}
                          >
                            Детали
                          </Button>
                          <Button
                            size="small"
                            color="success"
                            variant="contained"
                            disabled={isLifecyclePending || !['confirmed', 'active'].includes(booking.status)}
                            onClick={() => checkInMutation.mutate(booking.id)}
                            aria-label={`Отметить заезд для бронирования №${booking.id}`}
                          >
                            Заезд
                          </Button>
                          <Button
                            size="small"
                            color="primary"
                            variant="contained"
                            disabled={isLifecyclePending || booking.status !== 'active'}
                            onClick={() => checkOutMutation.mutate(booking.id)}
                            aria-label={`Отметить выезд для бронирования №${booking.id}`}
                          >
                            Выезд
                          </Button>
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            disabled={isLifecyclePending || !['confirmed', 'active'].includes(booking.status)}
                            onClick={() => markNoShowMutation.mutate(booking.id)}
                            aria-label={`Отметить незаезд для бронирования №${booking.id}`}
                          >
                            Не заехал
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {activeStatuses.length > 0 && (
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary">Выбраны статусы:</Typography>
                  {activeStatuses.map((status) => <Chip key={status} label={bookingStatusLabelMap[status]} size="small" />)}
                </Stack>
              </Box>
            )}
            <TablePagination
              component="div"
              count={activeStatuses.length > 0 ? filteredItems.length : (listQuery.data?.meta.total ?? 0)}
              page={Math.floor((query.offset ?? 0) / (query.limit ?? DEFAULT_LIMIT))}
              rowsPerPage={query.limit ?? DEFAULT_LIMIT}
              onPageChange={(_, page) => applyQuery({ offset: page * (query.limit ?? DEFAULT_LIMIT) })}
              onRowsPerPageChange={(e) => applyQuery({ limit: Number(e.target.value), offset: 0 })}
              rowsPerPageOptions={[5, 10, 20, 50]}
              labelRowsPerPage="Записей на странице"
            />
          </ContentCard>
        )}
      />

      <BookingDetailsPanel bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </>
  );
}
