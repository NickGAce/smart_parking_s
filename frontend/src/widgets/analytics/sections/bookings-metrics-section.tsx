import { Chip, Grid, Stack, Typography } from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { MetricCard } from '../../../shared/ui/metric-card';
import { LoadingState } from '../../../shared/ui/loading-state';
import { ContentCard } from '../../../shared/ui/content-card';
import type { AnalyticsBookings } from '../../../shared/types/analytics';

const statusLabels: Record<string, string> = {
  created: 'Создано',
  confirmed: 'Подтверждено',
  active: 'Активно',
  completed: 'Завершено',
  cancelled: 'Отменено',
  no_show: 'Не заехал',
};

export function BookingsMetricsSection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: AnalyticsBookings }) {
  if (isLoading) return <LoadingState variant="skeleton" lines={4} />;
  if (isError) return <ErrorState message="Не удалось загрузить метрики бронирований." />;
  if (!data) return <EmptyState title="Нет данных по бронированиям" />;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <MetricCard align="center" label="Бронирований" value={data.bookings_count} helperText="Общее число заявок." />
      </Grid>
      <Grid item xs={12} md={4}>
        <MetricCard
          align="center"
          label="Средняя длительность"
          value={`${data.average_booking_duration_minutes.toFixed(1)} мин`}
          helperText="Сколько в среднем длится одно бронирование."
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <ContentCard sx={{ p: 2, height: '100%', textAlign: 'center' }}>
          <Typography variant="cardTitle" gutterBottom>Качество бронирований</Typography>
          <Stack spacing={0.75} alignItems="center">
            <Typography variant="body2" color="text.secondary">Отмены: {(data.cancellation_rate * 100).toFixed(1)}%</Typography>
            <Typography variant="body2" color="text.secondary">Незаезды: {(data.no_show_rate * 100).toFixed(1)}%</Typography>
          </Stack>
        </ContentCard>
      </Grid>
      <Grid item xs={12}>
        <ContentCard sx={{ p: 2 }}>
          <Typography variant="cardTitle" gutterBottom>Распределение по статусам</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.keys(data.status_breakdown).length === 0 ? (
              <Typography color="text.secondary">Данные о статусах отсутствуют.</Typography>
            ) : Object.entries(data.status_breakdown).map(([status, count]) => (
              <Chip key={status} label={`${statusLabels[status] ?? status}: ${count}`} variant="outlined" />
            ))}
          </Stack>
        </ContentCard>
      </Grid>
    </Grid>
  );
}
