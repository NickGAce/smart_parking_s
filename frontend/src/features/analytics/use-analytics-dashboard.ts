import { useQueries } from '@tanstack/react-query';

import { analyticsApi } from '../../entities/analytics/api';
import { ANALYTICS_ANOMALY_FILTER_ROLES, hasRole } from '../../shared/config/roles';
import type { UserRole } from '../../shared/types/common';
import type { AnalyticsPeriod } from '../../shared/types/analytics';
import { analyticsQueryKeys } from './query-keys';

export interface AnalyticsDashboardFilters {
  period: AnalyticsPeriod;
  parkingLotId: number | null;
  zone: string;
  from: string;
  to: string;
  historyDays: number;
  bucketSizeHours: number;
  anomalyUserId: number | null;
}

function normalizeOptionalString(value: string) {
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function resolveForecastWindow(period: AnalyticsPeriod, from?: string, to?: string): { from: string; to: string } {
  if (from && to) {
    return { from, to };
  }

  const now = new Date();
  const start = new Date(now);

  if (period === 'day') {
    start.setDate(start.getDate() - 1);
  } else if (period === 'week') {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }

  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

export function useAnalyticsDashboard(filters: AnalyticsDashboardFilters, role?: UserRole) {
  const normalizedFrom = normalizeOptionalString(filters.from);
  const normalizedTo = normalizeOptionalString(filters.to);

  const baseParams = {
    period: filters.period,
    parking_lot_id: filters.parkingLotId ?? undefined,
    zone: normalizeOptionalString(filters.zone),
    from: normalizedFrom,
    to: normalizedTo,
  };

  const forecastWindow = resolveForecastWindow(filters.period, normalizedFrom, normalizedTo);

  const anomalyParams = {
    from: normalizedFrom,
    to: normalizedTo,
    parking_lot_id: filters.parkingLotId ?? undefined,
    user_id: hasRole(role, ANALYTICS_ANOMALY_FILTER_ROLES) ? filters.anomalyUserId ?? undefined : undefined,
  };

  const [summaryQuery, occupancyQuery, bookingsQuery, forecastQuery, anomaliesQuery] = useQueries({
    queries: [
      {
        queryKey: analyticsQueryKeys.summary(baseParams),
        queryFn: () => analyticsApi.getSummary(baseParams),
      },
      {
        queryKey: analyticsQueryKeys.occupancy(baseParams),
        queryFn: () => analyticsApi.getOccupancy(baseParams),
      },
      {
        queryKey: analyticsQueryKeys.bookings(baseParams),
        queryFn: () => analyticsApi.getBookings(baseParams),
      },
      {
        queryKey: analyticsQueryKeys.forecast({
          ...baseParams,
          from: forecastWindow.from,
          to: forecastWindow.to,
          history_days: filters.historyDays,
          bucket_size_hours: filters.bucketSizeHours,
        }),
        queryFn: () => analyticsApi.getOccupancyForecast({
          parking_lot_id: baseParams.parking_lot_id,
          zone: baseParams.zone,
          from: forecastWindow.from,
          to: forecastWindow.to,
          history_days: filters.historyDays,
          bucket_size_hours: filters.bucketSizeHours,
        }),
      },
      {
        queryKey: analyticsQueryKeys.anomalies(anomalyParams),
        queryFn: () => analyticsApi.getAnomalies(anomalyParams),
        enabled: role !== 'uk',
      },
    ],
  });

  return {
    summaryQuery,
    occupancyQuery,
    bookingsQuery,
    forecastQuery,
    anomaliesQuery,
  };
}
