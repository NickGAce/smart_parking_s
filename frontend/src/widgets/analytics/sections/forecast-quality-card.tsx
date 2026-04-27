import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Alert, Chip, Stack, Tooltip, Typography } from '@mui/material';

import type { ForecastQuality } from '../../../shared/types/analytics';
import { EmptyState } from '../../../shared/ui/empty-state';
import { LoadingState } from '../../../shared/ui/loading-state';

interface ForecastQualityCardProps {
  isLoading: boolean;
  isError: boolean;
  data?: ForecastQuality;
  selectedPeriodLabel: string;
}

const confidenceColor: Record<ForecastQuality['confidence'], 'error' | 'warning' | 'success'> = {
  low: 'error',
  medium: 'warning',
  high: 'success',
};

const confidenceLabel: Record<ForecastQuality['confidence'], string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
};

function evaluateMae(mae: number): string {
  if (mae <= 3) return 'Отлично: прогноз в среднем ошибается менее чем на 3 п.п.';
  if (mae <= 7) return 'Нормально: ошибка умеренная, прогноз пригоден для планирования.';
  return 'Внимание: ошибка заметная, стоит перепроверить модель и данные.';
}

function evaluateMape(mae: number, mape: number): string {
  if (mape <= 20) return 'Хорошо: процентная ошибка низкая.';
  if (mape <= 50) return 'Приемлемо: есть отклонения, но прогноз полезен.';
  if (mae <= 3) return 'MAPE высокий из‑за малых фактических значений в части бакетов (деление на близкие к нулю значения).';
  return 'Внимание: высокая относительная ошибка, прогноз может быть нестабильным.';
}

function evaluateRmse(rmse: number | null): string {
  if (rmse === null) return 'Недостаточно данных для RMSE.';
  if (rmse <= 4) return 'Разброс ошибок низкий.';
  if (rmse <= 9) return 'Разброс ошибок умеренный.';
  return 'Разброс ошибок высокий: возможны сильные промахи в отдельных интервалах.';
}

export function ForecastQualityCard({ isLoading, isError, data, selectedPeriodLabel }: ForecastQualityCardProps) {
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
        <Chip label={`Уверенность: ${confidenceLabel[data.confidence]}`} size="small" color={confidenceColor[data.confidence]} />
        <Tooltip
          title="MAE — средняя абсолютная ошибка в п.п. MAPE — средняя ошибка в % от факта. RMSE сильнее штрафует крупные промахи."
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
      <Typography variant="caption" color="text.secondary">
        Почему сейчас такой интервал: выбран фильтр «Период = {selectedPeriodLabel}». Измените фильтр «От/До» или «Период», чтобы пересчитать метрики.
      </Typography>
      <Alert severity={data.confidence === 'low' ? 'warning' : 'info'}>{data.explanation}</Alert>

      <Stack spacing={0.5}>
        <Typography variant="body2"><strong>Как интерпретировать ваши числа:</strong></Typography>
        <Typography variant="body2">• MAE: {evaluateMae(data.mae)}</Typography>
        <Typography variant="body2">• MAPE: {evaluateMape(data.mae, data.mape)}</Typography>
        <Typography variant="body2">• RMSE: {evaluateRmse(data.rmse)}</Typography>
        <Typography variant="body2">
          • Sample size: {data.sample_size < 24 ? 'мало данных, выводы предварительные.' : 'объем данных достаточный для рабочих выводов.'}
        </Typography>
      </Stack>
    </Stack>
  );
}
