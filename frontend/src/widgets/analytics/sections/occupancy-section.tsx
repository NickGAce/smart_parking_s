import { Grid, LinearProgress, Stack, Typography } from '@mui/material';

import { ContentCard } from '../../../shared/ui/content-card';
import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import { MetricCard } from '../../../shared/ui/metric-card';
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
  if (isLoading) return <LoadingState message="Загрузка метрик загрузки..." />;
  if (isError) return <ErrorState message="Не удалось загрузить метрики загрузки." />;
  if (!data) return <EmptyState title="Нет данных по загрузке" />;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <MetricCard label="Общая загрузка" value={`${data.occupancy_percent.toFixed(1)}%`} />
      </Grid>
      <Grid item xs={12} md={4}>
        <ContentCard sx={{ p: 2, height: '100%' }}>
          <Typography variant="cardTitle" gutterBottom>По зонам</Typography>
          <Stack spacing={1.2}>
            {data.by_zone.length === 0 ? (
              <Typography color="text.secondary">Нет разбивки по зонам.</Typography>
            ) : data.by_zone.map((zone) => <BarStat key={zone.zone} label={zone.zone} value={zone.occupancy_percent} />)}
          </Stack>
        </ContentCard>
      </Grid>
      <Grid item xs={12} md={4}>
        <ContentCard sx={{ p: 2, height: '100%' }}>
          <Typography variant="cardTitle" gutterBottom>По типам мест</Typography>
          <Stack spacing={1.2}>
            {data.by_spot_type.length === 0 ? (
              <Typography color="text.secondary">Нет разбивки по типам.</Typography>
            ) : data.by_spot_type.map((spotType) => <BarStat key={spotType.spot_type} label={spotType.spot_type} value={spotType.occupancy_percent} />)}
          </Stack>
        </ContentCard>
      </Grid>
      <Grid item xs={12}>
        <ContentCard sx={{ p: 2 }}>
          <Typography variant="cardTitle" gutterBottom>Пиковые часы</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {data.peak_hours.length === 0 ? (
              <Typography color="text.secondary">Для выбранного периода пиковые часы отсутствуют.</Typography>
            ) : data.peak_hours.map((peakHour) => (
              <ContentCard key={`${peakHour.hour}-${peakHour.bookings}`} sx={{ p: 1.5, minWidth: 120 }}>
                <Typography variant="body2" color="text.secondary">{String(peakHour.hour).padStart(2, '0')}:00</Typography>
                <Typography variant="h6">{peakHour.bookings}</Typography>
              </ContentCard>
            ))}
          </Stack>
        </ContentCard>
      </Grid>
    </Grid>
  );
}
