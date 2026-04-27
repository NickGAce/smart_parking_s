import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

import { EmptyState } from '../../../shared/ui/empty-state';
import { ErrorState } from '../../../shared/ui/error-state';
import { LoadingState } from '../../../shared/ui/loading-state';
import { StateFeedback } from '../../../shared/ui/state-feedback';
import type { Anomaly, AnomaliesResponse } from '../../../shared/types/analytics';
import type { UserRole } from '../../../shared/types/common';

function severityColor(severity: string): 'success' | 'warning' | 'error' {
  if (severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'success';
}

function severityLabel(severity: string): string {
  if (severity === 'high') return 'Критично';
  if (severity === 'medium') return 'Средний риск';
  return 'Низкий риск';
}

function renderMetrics(metrics: Record<string, string | number>) {
  return Object.entries(metrics)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function AnomalyDetails({ item }: { item: Anomaly }) {
  return (
    <Stack spacing={1.1}>
      <Box>
        <Typography variant="caption" color="text.secondary">Что произошло</Typography>
        <Typography variant="body2">{item.explanation ?? item.reason}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Почему это важно</Typography>
        <Typography variant="body2">{item.impact ?? item.severity_reason ?? 'Требуется оценка влияния на операционные процессы.'}</Typography>
        {item.severity_reason ? (
          <Typography variant="caption" color="text.secondary">Критерий серьезности: {item.severity_reason}</Typography>
        ) : null}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Что сделать</Typography>
        <Typography variant="body2">{item.recommended_action ?? 'Проведите дополнительную проверку и назначьте ответственного.'}</Typography>
      </Box>
    </Stack>
  );
}

export function AnomaliesSection({
  role,
  isLoading,
  isError,
  data,
  mode = 'detailed',
  maxItems,
}: {
  role?: UserRole;
  isLoading: boolean;
  isError: boolean;
  data?: AnomaliesResponse;
  mode?: 'compact' | 'detailed';
  maxItems?: number;
}) {
  const [selected, setSelected] = useState<Anomaly | null>(null);

  const visibleItems = useMemo(() => {
    if (!data) return [];
    if (!maxItems || data.items.length <= maxItems) return data.items;
    return data.items.slice(0, maxItems);
  }, [data, maxItems]);

  if (role === 'uk') {
    return <StateFeedback severity="info">Для роли УК раздел аномалий недоступен.</StateFeedback>;
  }

  if (isLoading) return <LoadingState variant="skeleton" lines={4} />;
  if (isError) return <ErrorState message="Не удалось загрузить аномалии." />;
  if (!data || data.items.length === 0) {
    return <EmptyState title="Аномалии не найдены" description="В выбранном диапазоне отклонения не обнаружены." />;
  }

  return (
    <>
      <Stack spacing={1.2}>
        {role === 'tenant' && (
          <StateFeedback severity="info">Показаны только аномалии, связанные с вашим профилем.</StateFeedback>
        )}
        {visibleItems.map((item, index) => (
          <Paper key={`${item.anomaly_type}-${index}`} variant="outlined" sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Stack spacing={0.8} flex={1}>
                <Typography variant="subtitle2">{item.anomaly_type}</Typography>
                <Typography variant="body2">{item.reason}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Связанный объект: {item.related_entity.entity_type} #{item.related_entity.entity_id}
                  {item.related_entity.label ? ` (${item.related_entity.label})` : ''}
                </Typography>
                {item.related_metric ? (
                  <Typography variant="caption" color="text.secondary">Ключевая метрика: {item.related_metric}</Typography>
                ) : null}

                {mode === 'detailed' ? (
                  <>
                    <Divider sx={{ my: 0.3 }} />
                    <AnomalyDetails item={item} />
                  </>
                ) : (
                  <Button variant="text" size="small" sx={{ alignSelf: 'flex-start', px: 0 }} onClick={() => setSelected(item)}>
                    Открыть детали
                  </Button>
                )}

                <Typography variant="caption" color="text.secondary">
                  Метрики: {renderMetrics(item.metrics)}
                </Typography>
              </Stack>
              <Chip color={severityColor(item.severity)} label={severityLabel(item.severity)} variant="outlined" />
            </Stack>
          </Paper>
        ))}

        {maxItems && data.items.length > maxItems ? (
          <Typography variant="caption" color="text.secondary">
            Показаны {maxItems} из {data.items.length} аномалий.
          </Typography>
        ) : null}
      </Stack>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selected?.anomaly_type}</DialogTitle>
        <DialogContent dividers>
          {selected ? <AnomalyDetails item={selected} /> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
