import { Alert, Paper, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import { useAnalyticsDashboard } from '../features/analytics/use-analytics-dashboard';
import type { AnalyticsDashboardFilters } from '../features/analytics/use-analytics-dashboard';
import { useCurrentUser } from '../features/auth/use-current-user';
import { useParkingLotsQuery } from '../features/parking-lots/use-parking-lots-query';
import { ANALYTICS_ANOMALY_FILTER_ROLES, hasRole } from '../shared/config/roles';
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

export function AnalyticsPage() {
  const { role } = useCurrentUser();
  const [filters, setFilters] = useState<AnalyticsDashboardFilters>(INITIAL_FILTERS);

  const parkingLotsQuery = useParkingLotsQuery({ limit: 100, offset: 0 });
  const parkingLotOptions = useMemo(
    () => (parkingLotsQuery.data?.items ?? []).map((lot) => ({ id: lot.id, name: lot.name })),
    [parkingLotsQuery.data?.items],
  );

  const queries = useAnalyticsDashboard(filters, role);
  const canManageAnomalyUser = hasRole(role, ANALYTICS_ANOMALY_FILTER_ROLES);

  return (
    <Stack spacing={2}>

      <Alert severity="info">
        Dashboard агрегируется на клиенте через отдельные endpoints: summary, occupancy, bookings, forecast, anomalies.
      </Alert>

      <DashboardFilters
        filters={filters}
        canManageAnomalyUser={canManageAnomalyUser}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onReset={() => setFilters(INITIAL_FILTERS)}
        parkingLotOptions={parkingLotOptions}
      />

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Сводные KPI</Typography>
        <SummaryKpiSection
          isLoading={queries.summaryQuery.isLoading}
          isError={queries.summaryQuery.isError}
          data={queries.summaryQuery.data}
        />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Загрузка парковки</Typography>
        <OccupancySection
          isLoading={queries.occupancyQuery.isLoading}
          isError={queries.occupancyQuery.isError}
          data={queries.occupancyQuery.data}
        />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Метрики бронирований</Typography>
        <BookingsMetricsSection
          isLoading={queries.bookingsQuery.isLoading}
          isError={queries.bookingsQuery.isError}
          data={queries.bookingsQuery.data}
        />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Прогноз загрузки</Typography>
        <ForecastSection
          isLoading={queries.forecastQuery.isLoading}
          isError={queries.forecastQuery.isError}
          data={queries.forecastQuery.data}
        />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Аномалии</Typography>
        <AnomaliesSection
          role={role}
          isLoading={queries.anomaliesQuery.isLoading}
          isError={queries.anomaliesQuery.isError}
          data={queries.anomaliesQuery.data}
        />
      </Paper>
    </Stack>
  );
}
