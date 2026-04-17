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
      <Grid item xs={12} sm={6} md={4}><MetricCard label="Загрузка" value={`${data.occupancy_percent.toFixed(1)}%`} /></Grid>
      <Grid item xs={12} sm={6} md={4}><MetricCard label="Бронирований" value={String(data.bookings_count)} /></Grid>
      <Grid item xs={12} sm={6} md={4}><MetricCard label="Средняя длительность" value={`${data.average_booking_duration_minutes.toFixed(1)} мин`} /></Grid>
      <Grid item xs={12} sm={6} md={6}><MetricCard label="Доля отмен" value={`${(data.cancellation_rate * 100).toFixed(1)}%`} /></Grid>
      <Grid item xs={12} sm={6} md={6}><MetricCard label="Доля no-show" value={`${(data.no_show_rate * 100).toFixed(1)}%`} /></Grid>
    </Grid>
  );
}
