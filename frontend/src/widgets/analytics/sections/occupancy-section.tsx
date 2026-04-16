import { Grid, LinearProgress, Paper, Stack, Typography } from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import type { AnalyticsOccupancy } from '../../../shared/types/analytics';

function BarStat({ label, value }: { label: string; value: number }) {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{value.toFixed(1)}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, value))} sx={{ height: 8, borderRadius: 999 }} />
    </Stack>
  );
}

export function OccupancySection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: AnalyticsOccupancy }) {
  if (isLoading) return <LoadingState message="Загрузка occupancy..." />;
  if (isError) return <ErrorState message="Не удалось загрузить occupancy metrics." />;
  if (!data) return <EmptyState title="Нет occupancy данных" />;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Overall occupancy</Typography>
          <Typography variant="h4">{data.occupancy_percent.toFixed(1)}%</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>By zone</Typography>
          <Stack spacing={1.2}>
            {data.by_zone.length === 0 ? (
              <Typography color="text.secondary">No zone breakdown.</Typography>
            ) : data.by_zone.map((zone) => <BarStat key={zone.zone} label={zone.zone} value={zone.occupancy_percent} />)}
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>By spot type</Typography>
          <Stack spacing={1.2}>
            {data.by_spot_type.length === 0 ? (
              <Typography color="text.secondary">No type breakdown.</Typography>
            ) : data.by_spot_type.map((spotType) => <BarStat key={spotType.spot_type} label={spotType.spot_type} value={spotType.occupancy_percent} />)}
          </Stack>
        </Paper>
      </Grid>
      <Grid item xs={12}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Peak hours</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {data.peak_hours.length === 0 ? (
              <Typography color="text.secondary">No peak hours for selected range.</Typography>
            ) : data.peak_hours.map((peakHour) => (
              <Paper key={`${peakHour.hour}-${peakHour.bookings}`} variant="outlined" sx={{ p: 1.5, minWidth: 120 }}>
                <Typography variant="body2" color="text.secondary">{String(peakHour.hour).padStart(2, '0')}:00</Typography>
                <Typography variant="h6">{peakHour.bookings}</Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
