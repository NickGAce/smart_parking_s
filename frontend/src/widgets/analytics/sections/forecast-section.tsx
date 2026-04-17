import { Chip, Stack, Typography } from '@mui/material';

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

export function ForecastSection({ isLoading, isError, data }: { isLoading: boolean; isError: boolean; data?: OccupancyForecast }) {
  if (isLoading) return <LoadingState message="Загрузка прогноза..." />;
  if (isError) return <ErrorState message="Не удалось загрузить прогноз." />;
  if (!data || data.forecast.length === 0) {
    return <EmptyState title="Нет данных прогноза" description="Для выбранного контекста прогнозные бакеты отсутствуют." />;
  }

  return (
    <Stack spacing={1.2}>
      {data.forecast.map((bucket) => (
        <ContentCard key={bucket.time_bucket} sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
            <Stack>
              <Typography variant="cardTitle">{new Date(bucket.time_bucket).toLocaleString()}</Typography>
              <Typography color="text.secondary">Прогноз загрузки: {bucket.predicted_occupancy_percent.toFixed(1)}%</Typography>
              <Typography color="text.secondary">Выборка: {bucket.samples}</Typography>
              <Typography variant="body2">{bucket.comment}</Typography>
            </Stack>
            <Chip label={`Уверенность: ${bucket.confidence}`} color={confidenceColor(bucket.confidence)} />
          </Stack>
        </ContentCard>
      ))}
    </Stack>
  );
}
