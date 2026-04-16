import { Grid, Paper, Stack, Typography } from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import type { AnalyticsSummary } from '../../../shared/types/analytics';

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h5">{value}</Typography>
      </Stack>
    </Paper>
  );
}

export function SummaryKpiSection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: AnalyticsSummary }) {
  if (isLoading) {
    return <LoadingState message="Загрузка KPI..." />;
  }

  if (isError) {
    return <ErrorState message="Не удалось загрузить KPI summary." />;
  }

  if (!data) {
    return <EmptyState title="Нет данных KPI" description="Попробуйте сменить период или контекст." />;
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={4}><KpiCard label="Occupancy" value={`${data.occupancy_percent.toFixed(1)}%`} /></Grid>
      <Grid item xs={12} sm={6} md={4}><KpiCard label="Bookings" value={String(data.bookings_count)} /></Grid>
      <Grid item xs={12} sm={6} md={4}><KpiCard label="Avg duration" value={`${data.average_booking_duration_minutes.toFixed(1)} min`} /></Grid>
      <Grid item xs={12} sm={6} md={6}><KpiCard label="Cancel rate" value={`${(data.cancellation_rate * 100).toFixed(1)}%`} /></Grid>
      <Grid item xs={12} sm={6} md={6}><KpiCard label="No-show rate" value={`${(data.no_show_rate * 100).toFixed(1)}%`} /></Grid>
    </Grid>
  );
}
