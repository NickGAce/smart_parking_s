import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
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
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BookingDetailsPanel } from '../features/bookings/components/booking-details-panel';
import { bookingStatuses } from '../features/bookings/constants';
import { useMyBookingsQuery } from '../features/bookings/hooks';
import { bookingStatusLabelMap, formatBookingDurationLabel, formatBookingInterval } from '../shared/config/booking-ui';
import { bookingStatusMap } from '../shared/config/status-map';
import { ContentCard } from '../shared/ui/content-card';
import { DateTimeField } from '../shared/ui/date-time-field';
import { FiltersSection } from '../shared/ui/filters-section';
import { DataListPageTemplate } from '../shared/ui/page-templates';
import { StatusChip } from '../shared/ui/status-chip';
import type { BookingStatus } from '../shared/types/common';
import type { BookingsQuery } from '../shared/types/booking';

function parseQuery(searchParams: URLSearchParams): Omit<BookingsQuery, 'mine'> {
  const statuses = [...searchParams.getAll('statuses[]'), ...searchParams.getAll('statuses')] as BookingStatus[];

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
  const filteredItems = useMemo(() => {
    const selectedStatuses = query.statuses ?? [];
    if (!data || selectedStatuses.length === 0) {
      return data?.items ?? [];
    }

    return data.items.filter((booking) => selectedStatuses.includes(booking.status));
  }, [data, query.statuses]);

  const updateStatuses = (status: BookingStatus, checked: boolean) => {
    const statuses = new Set(query.statuses ?? []);
    if (checked) {
      statuses.add(status);
    } else {
      statuses.delete(status);
    }

    setSearchParams(writeQuery({ ...query, statuses: Array.from(statuses), status: undefined }));
  };

  const hasAdvancedStatuses = Boolean((query.statuses?.length ?? 0) > 0);

  return (
    <>
      <DataListPageTemplate
        title="Мои бронирования"
        subtitle="Планируйте поездки заранее: фильтруйте заявки по периоду и быстро открывайте детали для изменений или отмены."
                headerActions={(
          <Button variant="contained" onClick={() => navigate('/bookings/new')}>
            Новое бронирование
          </Button>
        )}
        filters={(
          <FiltersSection
            onReset={() => setSearchParams(writeQuery({ sort_by: 'start_time', sort_order: 'desc' }))}
            resetLabel="Сбросить фильтры"
          >
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <DateTimeField
                    label="Начало периода"
                    value={query.from ?? ''}
                    onChange={(value) => setSearchParams(writeQuery({ ...query, from: value || undefined }))}
                    helperText="Показываем бронирования, которые начинаются не раньше этого времени."
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <DateTimeField
                    label="Окончание периода"
                    value={query.to ?? ''}
                    onChange={(value) => setSearchParams(writeQuery({ ...query, to: value || undefined }))}
                    helperText="Показываем бронирования, которые заканчиваются до выбранного времени."
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="my-bookings-status">Статус</InputLabel>
                    <Select
                      labelId="my-bookings-status"
                      label="Статус"
                      value={query.status ?? ''}
                      onChange={(e) => setSearchParams(writeQuery({ ...query, status: (e.target.value as BookingStatus) || undefined, statuses: undefined }))}
                    >
                      <MenuItem value="">Все статусы</MenuItem>
                      {bookingStatuses.map((status) => (
                        <MenuItem key={status} value={status}>{bookingStatusLabelMap[status]}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                {bookingStatuses.map((status) => (
                  <FormControlLabel
                    key={status}
                    control={<Switch size="small" checked={(query.statuses ?? []).includes(status)} onChange={(e) => updateStatuses(status, e.target.checked)} />}
                    label={bookingStatusLabelMap[status]}
                  />
                ))}
              </Stack>
            </Stack>
          </FiltersSection>
        )}
        isLoading={isLoading}
        errorText={error ? 'Не удалось загрузить список бронирований. Попробуйте обновить страницу.' : undefined}
        isEmpty={!isLoading && !error && filteredItems.length === 0}
        emptyText="Бронирования не найдены. Измените период или статусы в фильтрах."
        dataView={(
          <ContentCard padded={false}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell scope="col">Бронь</TableCell>
                  <TableCell scope="col">Статус</TableCell>
                  <TableCell scope="col">Интервал</TableCell>
                  <TableCell scope="col">Длительность</TableCell>
                  <TableCell scope="col" align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.map((booking) => (
                  <TableRow key={booking.id} hover>
                    <TableCell component="th" scope="row">
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">#{booking.id}</Typography>
                        <Typography variant="caption" color="text.secondary">Место #{booking.parking_spot_id}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={booking.status} mapping={bookingStatusMap} />
                    </TableCell>
                    <TableCell>{formatBookingInterval(booking.start_time, booking.end_time)}</TableCell>
                    <TableCell>{formatBookingDurationLabel(booking.start_time, booking.end_time)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        startIcon={<VisibilityOutlinedIcon />}
                        onClick={() => setSelectedBookingId(booking.id)}
                        aria-label={`Открыть детали бронирования №${booking.id}`}
                      >
                        Детали
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {hasAdvancedStatuses && (
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary">Применены статусы:</Typography>
                  {(query.statuses ?? []).map((status) => (
                    <Chip key={status} size="small" label={bookingStatusLabelMap[status]} />
                  ))}
                </Stack>
              </Box>
            )}
          </ContentCard>
        )}
      />

      <BookingDetailsPanel bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />
    </>
  );
}
