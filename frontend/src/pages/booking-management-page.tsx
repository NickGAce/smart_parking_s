import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Menu,
  ListSubheader,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { memo, useMemo, useState, type MouseEvent } from 'react';
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
import { DateTimeField } from '../shared/ui/date-time-field';
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
type LifecycleAction = 'check-in' | 'check-out';
type LifecyclePrimaryAction = { action: LifecycleAction; label: string; color: 'success' | 'primary' };

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

function getPrimaryLifecycleAction(status: BookingStatus): LifecyclePrimaryAction | null {
  if (status === 'active') {
    return { action: 'check-out', label: 'Выезд', color: 'primary' };
  }

  if (status === 'confirmed') {
    return { action: 'check-in', label: 'Прибытие', color: 'success' };
  }

  return null;
}

const stickyHeadCellSx = { bgcolor: 'action.hover', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2 };
const stickyFirstColumnSx = { position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 };

interface BookingTableRowProps {
  booking: NonNullable<ReturnType<typeof useBookingsQuery>['data']>['items'][number];
  isLifecyclePending: boolean;
  onCheckIn: (bookingId: number) => void;
  onCheckOut: (bookingId: number) => void;
  onOpenDetails: (bookingId: number) => void;
  onOpenActionsMenu: (event: MouseEvent<HTMLElement>, bookingId: number) => void;
}

const BookingTableRow = memo(function BookingTableRow({
  booking,
  isLifecyclePending,
  onCheckIn,
  onCheckOut,
  onOpenDetails,
  onOpenActionsMenu,
}: BookingTableRowProps) {
  const primaryAction = getPrimaryLifecycleAction(booking.status);

  return (
    <TableRow hover>
      <TableCell component="th" scope="row" sx={stickyFirstColumnSx}>
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
        <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap>
          {primaryAction ? (
            <Button
              size="small"
              color={primaryAction.color}
              variant="contained"
              disabled={isLifecyclePending}
              onClick={() => (primaryAction.action === 'check-in' ? onCheckIn(booking.id) : onCheckOut(booking.id))}
              aria-label={`Основное действие по бронированию №${booking.id}`}
            >
              {primaryAction.label}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityOutlinedIcon />}
            onClick={() => onOpenDetails(booking.id)}
            aria-label={`Открыть детали бронирования №${booking.id}`}
          >
            Детали
          </Button>
          <Tooltip title="Дополнительные действия">
            <span>
              <IconButton
                size="small"
                onClick={(event) => onOpenActionsMenu(event, booking.id)}
                aria-label={`Дополнительные действия для бронирования №${booking.id}`}
              >
                <MoreVertOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </TableCell>
    </TableRow>
  );
});

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
  const [actionsAnchor, setActionsAnchor] = useState<HTMLElement | null>(null);
  const [actionsBookingId, setActionsBookingId] = useState<number | null>(null);
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
  const selectedBooking = visibleItems.find((booking) => booking.id === actionsBookingId);
  const canMarkNoShow = Boolean(selectedBooking && ['confirmed', 'active'].includes(selectedBooking.status));
  const canCheckInFromMenu = Boolean(selectedBooking && selectedBooking.status === 'active');

  const openActionsMenu = (event: MouseEvent<HTMLElement>, bookingId: number) => {
    setActionsAnchor(event.currentTarget);
    setActionsBookingId(bookingId);
  };

  const closeActionsMenu = () => {
    setActionsAnchor(null);
    setActionsBookingId(null);
  };

  return (
    <>
      <DataListPageTemplate
        title="Управление бронированиями"
        subtitle="Операционный экран для контроля статусов, интервалов и действий по жизненному циклу бронирований."
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
            actions={(
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 32 }}>
                <Typography variant="caption" color="text.secondary">Выбрано:</Typography>
                <Chip icon={<TuneOutlinedIcon />} label={`${activeStatuses.length} активных статусов`} size="small" variant="outlined" />
              </Stack>
            )}
          >
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="tableLabel" color="text.secondary">Локация и период</Typography>
                </Grid>
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
                  <DateTimeField
                    label="Начало периода"
                    value={query.from ?? ''}
                    onChange={(value) => applyQuery({ from: value || undefined }, true)}
                    disabled={isGuardView}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <DateTimeField
                    label="Окончание периода"
                    value={query.to ?? ''}
                    onChange={(value) => applyQuery({ to: value || undefined }, true)}
                    disabled={isGuardView}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="tableLabel" color="text.secondary">Статусы и сортировка</Typography>
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

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                <Typography variant="tableLabel" color="text.secondary">Быстрые статусы:</Typography>
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
                    <TableCell scope="col" sx={{ ...stickyHeadCellSx, ...stickyFirstColumnSx, zIndex: 3 }}>Бронь</TableCell>
                    <TableCell scope="col" sx={stickyHeadCellSx}>Пользователь</TableCell>
                    <TableCell scope="col" sx={stickyHeadCellSx}>Статус</TableCell>
                    <TableCell scope="col" sx={stickyHeadCellSx}>Интервал</TableCell>
                    <TableCell scope="col" sx={stickyHeadCellSx}>Длительность</TableCell>
                    <TableCell scope="col" align="right" sx={stickyHeadCellSx}>Операции</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleItems.map((booking) => (
                    <BookingTableRow
                      key={booking.id}
                      booking={booking}
                      isLifecyclePending={isLifecyclePending}
                      onCheckIn={checkInMutation.mutate}
                      onCheckOut={checkOutMutation.mutate}
                      onOpenDetails={setSelectedBookingId}
                      onOpenActionsMenu={openActionsMenu}
                    />
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
      <Menu
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={closeActionsMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <ListSubheader disableSticky>Дополнительные операции</ListSubheader>
        <MenuItem
          disabled={!canCheckInFromMenu || isLifecyclePending || !actionsBookingId}
          onClick={() => {
            if (!actionsBookingId) return;
            checkInMutation.mutate(actionsBookingId);
            closeActionsMenu();
          }}
        >
          Принудительное прибытие
        </MenuItem>
        <MenuItem
          disabled={!canMarkNoShow || isLifecyclePending || !actionsBookingId}
          onClick={() => {
            if (!actionsBookingId) return;
            markNoShowMutation.mutate(actionsBookingId);
            closeActionsMenu();
          }}
          sx={{ color: 'warning.main' }}
        >
          Отметить «неявка»
        </MenuItem>
      </Menu>
    </>
  );
}
