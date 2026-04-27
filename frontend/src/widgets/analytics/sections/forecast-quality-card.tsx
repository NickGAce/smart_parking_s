import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Alert, Chip, Stack, Tooltip, Typography } from '@mui/material';

import type { ForecastQuality } from '../../../shared/types/analytics';
import { EmptyState } from '../../../shared/ui/empty-state';
import { LoadingState } from '../../../shared/ui/loading-state';

interface ForecastQualityCardProps {
  isLoading: boolean;
  isError: boolean;
  data?: ForecastQuality;
}

const confidenceColor: Record<ForecastQuality['confidence'], 'error' | 'warning' | 'success'> = {
  low: 'error',
  medium: 'warning',
  high: 'success',
};

export function ForecastQualityCard({ isLoading, isError, data }: ForecastQualityCardProps) {
  if (isLoading) {
    return <LoadingState message="Рассчитываем метрики качества прогноза..." />;
  }

  if (isError) {
    return <Alert severity="error">Не удалось загрузить качество прогноза.</Alert>;
  }

  if (!data) {
    return <EmptyState title="Нет данных" description="Для выбранных фильтров метрики качества пока недоступны." compact />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h6">Качество прогноза</Typography>
        <Chip label={`Confidence: ${data.confidence}`} size="small" color={confidenceColor[data.confidence]} />
        <Tooltip
          title="MAE — средняя абсолютная ошибка прогноза. MAPE — средняя ошибка в процентах от факта. Чем ниже оба значения, тем лучше."
          arrow
        >
          <InfoOutlinedIcon fontSize="small" color="action" sx={{ cursor: 'help' }} />
        </Tooltip>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Typography variant="body2"><strong>MAE:</strong> {data.mae.toFixed(2)} п.п.</Typography>
        <Typography variant="body2"><strong>MAPE:</strong> {data.mape.toFixed(2)}%</Typography>
        {data.rmse !== null && <Typography variant="body2"><strong>RMSE:</strong> {data.rmse.toFixed(2)} п.п.</Typography>}
        <Typography variant="body2"><strong>Sample size:</strong> {data.sample_size}</Typography>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Период оценки: {new Date(data.evaluated_period.from_time).toLocaleString()} — {new Date(data.evaluated_period.to_time).toLocaleString()} ({data.evaluated_period.bucket}).
      </Typography>
      <Alert severity={data.confidence === 'low' ? 'warning' : 'info'}>{data.explanation}</Alert>
    </Stack>
  );
}
