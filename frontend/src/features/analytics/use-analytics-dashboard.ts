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

export function useAnalyticsDashboard(filters: AnalyticsDashboardFilters, role?: UserRole) {
  const baseParams = {
    period: filters.period,
    parking_lot_id: filters.parkingLotId ?? undefined,
    zone: normalizeOptionalString(filters.zone),
    from: normalizeOptionalString(filters.from),
    to: normalizeOptionalString(filters.to),
  };

  const anomalyParams = {
    from: normalizeOptionalString(filters.from),
    to: normalizeOptionalString(filters.to),
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
          history_days: filters.historyDays,
          bucket_size_hours: filters.bucketSizeHours,
        }),
        queryFn: () => analyticsApi.getOccupancyForecast({
          ...baseParams,
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
