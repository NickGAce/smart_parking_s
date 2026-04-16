import { Chip, Grid, Paper, Stack, Typography } from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import type { AnalyticsBookings } from '../../../shared/types/analytics';

export function BookingsMetricsSection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: AnalyticsBookings }) {
  if (isLoading) return <LoadingState message="Загрузка booking metrics..." />;
  if (isError) return <ErrorState message="Не удалось загрузить booking metrics." />;
  if (!data) return <EmptyState title="Нет booking данных" />;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1">Bookings count</Typography>
          <Typography variant="h4">{data.bookings_count}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1">Avg duration</Typography>
          <Typography variant="h4">{data.average_booking_duration_minutes.toFixed(1)} min</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1">Rates</Typography>
          <Typography>Cancel: {(data.cancellation_rate * 100).toFixed(1)}%</Typography>
          <Typography>No-show: {(data.no_show_rate * 100).toFixed(1)}%</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Status breakdown</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.keys(data.status_breakdown).length === 0 ? (
              <Typography color="text.secondary">No status breakdown available.</Typography>
            ) : Object.entries(data.status_breakdown).map(([status, count]) => (
              <Chip key={status} label={`${status}: ${count}`} variant="outlined" />
            ))}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
