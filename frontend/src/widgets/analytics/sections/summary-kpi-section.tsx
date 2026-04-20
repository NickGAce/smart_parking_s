import { Grid } from '@mui/material';

import { EmptyStateIllustrated } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import { MetricCard } from '../../../shared/ui/metric-card';
import type { AnalyticsSummary } from '../../../shared/types/analytics';

export function SummaryKpiSection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: AnalyticsSummary }) {
  if (isLoading) {
    return <LoadingState message="Загрузка KPI..." />;
  }

  if (isError) {
    return <ErrorState message="Не удалось загрузить сводные KPI." />;
  }

  if (!data) {
    return <EmptyStateIllustrated title="Нет данных KPI" description="Попробуйте изменить период или параметры фильтра." />;
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard align="center" label="Загрузка" value={`${data.occupancy_percent.toFixed(1)}%`} helperText="Средняя занятость мест." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard align="center" label="Бронирований" value={String(data.bookings_count)} helperText="Общее число операций за период." />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <MetricCard
          align="center"
          label="Средняя длительность"
          value={`${data.average_booking_duration_minutes.toFixed(1)} мин`}
          helperText="Среднее время одной сессии парковки."
        />
      </Grid>
      <Grid item xs={12} sm={6} md={6}>
        <MetricCard
          align="center"
          label="Доля отмен"
          value={`${(data.cancellation_rate * 100).toFixed(1)}%`}
          badgeLabel={data.cancellation_rate > 0.15 ? 'Риск' : 'Норма'}
          badgeColor={data.cancellation_rate > 0.15 ? 'warning' : 'success'}
          helperText="Процент заявок, отмененных до начала."
        />
      </Grid>
      <Grid item xs={12} sm={6} md={6}>
        <MetricCard
          align="center"
          label="Доля no-show"
          value={`${(data.no_show_rate * 100).toFixed(1)}%`}
          badgeLabel={data.no_show_rate > 0.1 ? 'Внимание' : 'Норма'}
          badgeColor={data.no_show_rate > 0.1 ? 'warning' : 'success'}
          helperText="Бронирования без фактического заезда."
        />
      </Grid>
    </Grid>
  );
}
