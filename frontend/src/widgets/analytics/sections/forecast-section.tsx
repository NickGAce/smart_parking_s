import { Chip, Divider, Grid, Stack, Typography } from '@mui/material';

import { ContentCard } from '../../../shared/ui/content-card';
import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import type { OccupancyForecast } from '../../../shared/types/analytics';

function confidenceColor(confidence: string): 'success' | 'warning' | 'default' {
  const normalized = confidence.toLowerCase();
  if (normalized.includes('high')) return 'success';
  if (normalized.includes('low')) return 'warning';
  return 'default';
}

function confidenceLabel(confidence: string): string {
  const normalized = confidence.toLowerCase();
  if (normalized.includes('high')) return 'Высокая';
  if (normalized.includes('low')) return 'Низкая';
  return 'Средняя';
}

function formatBucketTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ForecastSection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: OccupancyForecast }) {
  if (isLoading) return <LoadingState message="Загрузка прогноза..." />;
  if (isError) return <ErrorState message="Не удалось загрузить прогноз." />;
  if (!data || data.forecast.length === 0) {
    return <EmptyState title="Нет данных прогноза" description="Для выбранного контекста прогнозные бакеты отсутствуют." />;
  }

  const sortedBuckets = [...data.forecast].sort((a, b) => new Date(a.time_bucket).getTime() - new Date(b.time_bucket).getTime());
  const previewBuckets = sortedBuckets.slice(0, 12);
  const hiddenBuckets = sortedBuckets.slice(12);

  return (
    <Stack spacing={1.5} textAlign="center">
      <ContentCard sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Горизонт прогноза: {formatBucketTime(sortedBuckets[0].time_bucket)} — {formatBucketTime(sortedBuckets[sortedBuckets.length - 1].time_bucket)}
          </Typography>
          <Chip size="small" variant="outlined" label={`Бакетов: ${sortedBuckets.length}`} />
        </Stack>
      </ContentCard>

      <Grid container spacing={1.5}>
        {previewBuckets.map((bucket) => (
          <Grid key={bucket.time_bucket} item xs={12} md={6}>
            <ContentCard sx={{ p: 1.5, height: '100%' }}>
              <Stack spacing={0.5} alignItems="center">
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatBucketTime(bucket.time_bucket)}</Typography>
                  <Chip size="small" variant="outlined" label={confidenceLabel(bucket.confidence)} color={confidenceColor(bucket.confidence)} />
                </Stack>
                <Typography variant="h6">{bucket.predicted_occupancy_percent.toFixed(1)}%</Typography>
                <Typography variant="caption" color="text.secondary">Выборка: {bucket.samples}</Typography>
              </Stack>
            </ContentCard>
          </Grid>
        ))}
      </Grid>

      {hiddenBuckets.length > 0 ? (
        <ContentCard sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Дополнительно: {hiddenBuckets.length} бакетов (полный список)
          </Typography>
          <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }} alignItems="stretch">
            {hiddenBuckets.map((bucket) => (
              <Stack key={bucket.time_bucket} spacing={0.4}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                  <Typography variant="body2">{formatBucketTime(bucket.time_bucket)}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{bucket.predicted_occupancy_percent.toFixed(1)}%</Typography>
                </Stack>
                <Divider />
              </Stack>
            ))}
          </Stack>
        </ContentCard>
      ) : null}
    </Stack>
  );
}
