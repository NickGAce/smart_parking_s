import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import type { AnomaliesResponse } from '../../../shared/types/analytics';
import type { UserRole } from '../../../shared/types/common';

function severityColor(severity: string): 'success' | 'warning' | 'error' {
  if (severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'success';
}

export function AnomaliesSection({
  role,
  isLoading,
  isError,
  data,
}: {
  role?: UserRole;
  isLoading: boolean;
  isError: boolean;
  data?: AnomaliesResponse;
}) {
  if (role === 'uk') {
    return <Alert severity="info">Роль uk не имеет доступа к anomalies analytics.</Alert>;
  }

  if (isLoading) return <LoadingState message="Загрузка anomalies..." />;
  if (isError) return <ErrorState message="Не удалось загрузить anomalies." />;
  if (!data || data.items.length === 0) {
    return <EmptyState title="Аномалии не найдены" description="В выбранном диапазоне отклонения не обнаружены." />;
  }

  return (
    <Stack spacing={1.2}>
      {role === 'tenant' && (
        <Alert severity="info">Tenant получает только аномалии, связанные с текущим пользователем.</Alert>
      )}
      {data.items.map((item, index) => (
        <Paper key={`${item.anomaly_type}-${index}`} variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">{item.anomaly_type}</Typography>
              <Typography>{item.reason}</Typography>
              <Typography variant="body2" color="text.secondary">
                Related: {item.related_entity.entity_type} #{item.related_entity.entity_id}
                {item.related_entity.label ? ` (${item.related_entity.label})` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">Metrics: {JSON.stringify(item.metrics)}</Typography>
            </Stack>
            <Chip color={severityColor(item.severity)} label={`Severity: ${item.severity}`} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
