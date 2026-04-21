import { Alert, Chip, Grid, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import { useAnalyticsDashboard } from '../features/analytics/use-analytics-dashboard';
import type { AnalyticsDashboardFilters } from '../features/analytics/use-analytics-dashboard';
import { useCurrentUser } from '../features/auth/use-current-user';
import { useParkingLotsQuery } from '../features/parking-lots/use-parking-lots-query';
import { ANALYTICS_ANOMALY_FILTER_ROLES, hasRole } from '../shared/config/roles';
import { DataPanel } from '../shared/ui/data-panel';
import { MetricCard } from '../shared/ui/metric-card';
import { PageContentLayout } from '../shared/ui/page-content-layout';
import { SectionHeader } from '../shared/ui/section-header';
import { DashboardFilters } from '../widgets/analytics/dashboard-filters';
import { AnomaliesSection } from '../widgets/analytics/sections/anomalies-section';
import { BookingsMetricsSection } from '../widgets/analytics/sections/bookings-metrics-section';
import { ForecastSection } from '../widgets/analytics/sections/forecast-section';
import { OccupancySection } from '../widgets/analytics/sections/occupancy-section';
import { SummaryKpiSection } from '../widgets/analytics/sections/summary-kpi-section';

const INITIAL_FILTERS: AnalyticsDashboardFilters = {
  period: 'week' as const,
  parkingLotId: null,
  zone: '',
  from: '',
  to: '',
  historyDays: 56,
  bucketSizeHours: 1,
  anomalyUserId: null,
};

const PERIOD_LABELS: Record<AnalyticsDashboardFilters['period'], string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

export function AnalyticsPage() {
  const { role } = useCurrentUser();
  const [filters, setFilters] = useState<AnalyticsDashboardFilters>(INITIAL_FILTERS);

  const parkingLotsQuery = useParkingLotsQuery({ limit: 100, offset: 0 });
  const parkingLotOptions = useMemo(
    () => (parkingLotsQuery.data?.items ?? []).map((lot) => ({ id: lot.id, name: lot.name })),
    [parkingLotsQuery.data?.items],
  );

  const selectedLotName = useMemo(() => {
    if (!filters.parkingLotId) return 'Все парковки';
    return parkingLotOptions.find((lot) => lot.id === filters.parkingLotId)?.name ?? `Парковка #${filters.parkingLotId}`;
  }, [filters.parkingLotId, parkingLotOptions]);

  const queries = useAnalyticsDashboard(filters, role);
  const canManageAnomalyUser = hasRole(role, ANALYTICS_ANOMALY_FILTER_ROLES);

  const criticalAnomalies = queries.anomaliesQuery.data?.items.filter((item) => item.severity === 'high').length ?? 0;

  return (
    <PageContentLayout spacing={2.5}>
      <Stack spacing={1.5}>
        <SectionHeader
          title="Аналитический центр"
          subtitle="Четкая картина по состоянию парковки: KPI, тренды, прогноз и проблемные зоны."
        />
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Период: ${PERIOD_LABELS[filters.period]}`} variant="outlined" />
            <Chip size="small" label={`Контур: ${selectedLotName}`} variant="outlined" />
            <Chip
              size="small"
              label={criticalAnomalies > 0 ? `Критичные аномалии: ${criticalAnomalies}` : 'Критичных аномалий нет'}
              color={criticalAnomalies > 0 ? 'error' : 'success'}
              variant="outlined"
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">Данные обновляются через единый клиентский слой аналитики.</Typography>
        </Stack>
      </Stack>

      <DashboardFilters
        filters={filters}
        canManageAnomalyUser={canManageAnomalyUser}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(INITIAL_FILTERS)}
        parkingLotOptions={parkingLotOptions}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <MetricCard
            align="center"
            label="Текущая загрузка"
            value={queries.summaryQuery.data ? `${queries.summaryQuery.data.occupancy_percent.toFixed(1)}%` : '—'}
            helperText="Быстрый индикатор состояния площадки."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            align="center"
            label="Активность бронирований"
            value={queries.summaryQuery.data ? String(queries.summaryQuery.data.bookings_count) : '—'}
            helperText="Количество операций в выбранном периоде."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <MetricCard
            align="center"
            label="Операционный риск"
            value={criticalAnomalies > 0 ? 'Требует внимания' : 'Контролируемо'}
            badgeLabel={criticalAnomalies > 0 ? 'Высокий' : 'Низкий'}
            badgeColor={criticalAnomalies > 0 ? 'error' : 'success'}
            helperText="Оценка на основе критичных аномалий и отклонений."
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} xl={8}>
          <DataPanel title="Ключевые показатели" subtitle="Базовые показатели эффективности за выбранный период.">
            <SummaryKpiSection
              isLoading={queries.summaryQuery.isLoading}
              isError={queries.summaryQuery.isError}
              data={queries.summaryQuery.data}
            />
          </DataPanel>
        </Grid>
        <Grid item xs={12} xl={4}>
          <DataPanel title="Операционные акценты" subtitle="Что требует реакции команды.">
            <Stack spacing={1.2}>
              <Alert severity={criticalAnomalies > 0 ? 'warning' : 'success'}>
                {criticalAnomalies > 0
                  ? `Обнаружено ${criticalAnomalies} критичных аномалий. Приоритизируйте проблемные зоны.`
                  : 'Критичных отклонений не обнаружено.'}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Наибольшую ценность дают блоки «Загрузка парковки» и «Прогноз», они показывают где и когда возникнет дефицит мест.
              </Typography>
            </Stack>
          </DataPanel>
        </Grid>
      </Grid>

      <DataPanel title="Загрузка парковки" subtitle="Распределение по зонам, типам мест и пиковым часам.">
        <OccupancySection
          isLoading={queries.occupancyQuery.isLoading}
          isError={queries.occupancyQuery.isError}
          data={queries.occupancyQuery.data}
        />
      </DataPanel>

      <Grid container spacing={2}>
        <Grid item xs={12} xl={6}>
          <DataPanel title="Метрики бронирований" subtitle="Структура статусов и качество пользовательского потока.">
            <BookingsMetricsSection
              isLoading={queries.bookingsQuery.isLoading}
              isError={queries.bookingsQuery.isError}
              data={queries.bookingsQuery.data}
            />
          </DataPanel>
        </Grid>
        <Grid item xs={12} xl={6}>
          <DataPanel title="Прогноз загрузки" subtitle="Оценка будущей занятости по временным бакетам.">
            <ForecastSection
              isLoading={queries.forecastQuery.isLoading}
              isError={queries.forecastQuery.isError}
              data={queries.forecastQuery.data}
            />
          </DataPanel>
        </Grid>
      </Grid>

      <DataPanel title="Аномалии" subtitle="Отклонения и потенциальные инциденты, влияющие на операционную стабильность.">
        <AnomaliesSection
          role={role}
          isLoading={queries.anomaliesQuery.isLoading}
          isError={queries.anomaliesQuery.isError}
          data={queries.anomaliesQuery.data}
        />
      </DataPanel>
    </PageContentLayout>
  );
}
