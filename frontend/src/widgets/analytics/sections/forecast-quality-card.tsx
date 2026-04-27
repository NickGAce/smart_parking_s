import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Alert, Box, Chip, Stack, Tooltip, Typography } from '@mui/material';

import type { ForecastQuality } from '../../../shared/types/analytics';
import { EmptyState } from '../../../shared/ui/empty-state';
import { LoadingState } from '../../../shared/ui/loading-state';

interface ForecastQualityCardProps {
  isLoading: boolean;
  isError: boolean;
  data?: ForecastQuality;
  selectedPeriodLabel: string;
  settings: {
    historyDays: number;
    bucketSizeHours: number;
    forecastQualityBucket: 'hour' | 'day';
  };
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

function buildPolylinePoints(values: number[], width: number, height: number) {
  if (values.length === 0) return '';
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (value / 100) * height;
      return `${x},${Math.max(0, Math.min(height, y))}`;
    })
    .join(' ');
}

export function ForecastQualityCard({ isLoading, isError, data, selectedPeriodLabel, settings }: ForecastQualityCardProps) {
  if (isLoading) {
    return <LoadingState message="Рассчитываем метрики качества прогноза..." />;
  }

  if (isError) {
    return <Alert severity="error">Не удалось загрузить качество прогноза.</Alert>;
  }

  if (!data) {
    return <EmptyState title="Нет данных" description="Для выбранных фильтров метрики качества пока недоступны." compact />;
  }

  const actualValues = data.comparison_series.map((item) => item.actual_occupancy_percent);
  const forecastValues = data.comparison_series.map((item) => item.predicted_occupancy_percent);
  const chartWidth = 900;
  const chartHeight = 240;
  const errorChartHeight = 120;
  const actualPath = buildPolylinePoints(actualValues, chartWidth, chartHeight);
  const forecastPath = buildPolylinePoints(forecastValues, chartWidth, chartHeight);
  const absoluteErrorValues = data.comparison_series.map((item) => item.absolute_error);
  const errorPath = buildPolylinePoints(absoluteErrorValues, chartWidth, errorChartHeight);
  const highErrorThreshold = Math.max(5, data.mae * 1.5);
  const highErrorPoints = data.comparison_series
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.absolute_error >= highErrorThreshold)
    .slice(0, 120);

  const topErrorBuckets = [...data.comparison_series]
    .sort((a, b) => b.absolute_error - a.absolute_error)
    .slice(0, 5);

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
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" variant="outlined" label={`Период: ${selectedPeriodLabel}`} />
        <Chip size="small" variant="outlined" label={`History: ${settings.historyDays} дн.`} />
        <Chip size="small" variant="outlined" label={`Bucket прогноза: ${settings.bucketSizeHours} ч`} />
        <Chip size="small" variant="outlined" label={`Backtest bucket: ${settings.forecastQualityBucket}`} />
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Период оценки: {new Date(data.evaluated_period.from_time).toLocaleString()} — {new Date(data.evaluated_period.to_time).toLocaleString()} ({data.evaluated_period.bucket}).
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Почему сейчас такой интервал: выбран фильтр «Период = {selectedPeriodLabel}». Измените фильтр «От/До» или «Период», чтобы пересчитать метрики.
      </Typography>
      <Alert severity={data.confidence === 'low' ? 'warning' : 'info'}>{data.explanation}</Alert>

      <Stack spacing={0.8}>
        <Typography variant="body2"><strong>График факт vs прогноз</strong></Typography>
        {data.comparison_series.length === 0 ? (
          <Typography variant="caption" color="text.secondary">Нет точек для визуализации.</Typography>
        ) : (
          <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 1.5, p: 1, overflowX: 'auto' }}>
            <svg width={chartWidth} height={chartHeight} role="img" aria-label="График факт и прогноз загрузки">
              {[0, 25, 50, 75, 100].map((value) => {
                const y = chartHeight - (value / 100) * chartHeight;
                return (
                  <g key={value}>
                    <line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#e0e0e0" strokeDasharray="4 3" />
                    <text x={4} y={Math.max(12, y - 2)} fill="#757575" fontSize="10">{value}%</text>
                  </g>
                );
              })}
              <polyline fill="none" stroke="#2e7d32" strokeWidth={2.5} points={actualPath} />
              <polyline fill="none" stroke="#1976d2" strokeWidth={2.5} points={forecastPath} />
              {highErrorPoints.map(({ item, index }) => {
                const x = data.comparison_series.length <= 1
                  ? 0
                  : (index / (data.comparison_series.length - 1)) * chartWidth;
                return <line key={`${item.time_bucket}-${index}`} x1={x} x2={x} y1={0} y2={chartHeight} stroke="#ff9800" strokeOpacity={0.25} />;
              })}
            </svg>
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">🟢 Факт</Typography>
              <Typography variant="caption" color="text.secondary">🔵 Прогноз</Typography>
              <Typography variant="caption" color="text.secondary">🟠 Зоны больших ошибок</Typography>
            </Stack>
          </Box>
        )}
      </Stack>

      <Stack spacing={0.8}>
        <Typography variant="body2"><strong>График абсолютной ошибки (|факт - прогноз|)</strong></Typography>
        {data.comparison_series.length === 0 ? (
          <Typography variant="caption" color="text.secondary">Нет точек для визуализации.</Typography>
        ) : (
          <Box sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 1.5, p: 1, overflowX: 'auto' }}>
            <svg width={chartWidth} height={errorChartHeight} role="img" aria-label="График абсолютной ошибки прогноза">
              {[0, 5, 10, 15, 20, 25].map((value) => {
                const y = errorChartHeight - (value / 25) * errorChartHeight;
                return (
                  <g key={value}>
                    <line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#eeeeee" />
                    <text x={4} y={Math.max(10, y - 2)} fill="#757575" fontSize="10">{value}</text>
                  </g>
                );
              })}
              <polyline fill="none" stroke="#ef6c00" strokeWidth={2.2} points={errorPath} />
            </svg>
          </Box>
        )}
      </Stack>

      <Stack spacing={0.5}>
        <Typography variant="body2"><strong>Худшие интервалы (топ-5 по ошибке):</strong></Typography>
        {topErrorBuckets.length === 0 ? (
          <Typography variant="caption" color="text.secondary">Нет данных.</Typography>
        ) : (
          topErrorBuckets.map((item) => (
            <Typography key={item.time_bucket} variant="caption" color="text.secondary">
              {new Date(item.time_bucket).toLocaleString()}: факт {item.actual_occupancy_percent.toFixed(1)}% / прогноз {item.predicted_occupancy_percent.toFixed(1)}% / ошибка {item.absolute_error.toFixed(1)} п.п.
            </Typography>
          ))
        )}
      </Stack>

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
