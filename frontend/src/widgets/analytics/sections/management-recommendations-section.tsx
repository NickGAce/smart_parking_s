import { Chip, Paper, Stack, Typography } from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import type { ManagementRecommendationsResponse, ManagementSeverity } from '../../../shared/types/analytics';

function severityColor(severity: ManagementSeverity): 'success' | 'warning' | 'error' {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'success';
}

function severityLabel(severity: ManagementSeverity): string {
  if (severity === 'critical') return 'Критично';
  if (severity === 'high') return 'Высокий приоритет';
  if (severity === 'medium') return 'Средний приоритет';
  return 'Низкий приоритет';
}

export function ManagementRecommendationsSection({
  isLoading,
  isError,
  data,
}: {
  isLoading: boolean;
  isError: boolean;
  data?: ManagementRecommendationsResponse;
}) {
  if (isLoading) return <LoadingState variant="skeleton" lines={4} />;
  if (isError) return <ErrorState message="Не удалось загрузить управленческие рекомендации." />;
  if (!data || data.items.length === 0) {
    return <EmptyState title="Критичных рекомендаций нет" description="Система не обнаружила приоритетных действий в выбранном периоде." />;
  }

  return (
    <Stack spacing={1.25}>
      {data.items.map((item) => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">{item.title}</Typography>
              <Typography variant="body2" color="text.secondary">{item.description}</Typography>
              <Typography variant="body2"><strong>Действие:</strong> {item.recommended_action}</Typography>
              <Typography variant="body2"><strong>Ожидаемый эффект:</strong> {item.expected_effect}</Typography>
              <Typography variant="caption" color="text.secondary">Источник: {item.metric_source}</Typography>
              <Typography variant="caption" color="text.secondary">Доказательства: {item.evidence}</Typography>
            </Stack>
            <Chip variant="outlined" color={severityColor(item.severity)} label={severityLabel(item.severity)} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
