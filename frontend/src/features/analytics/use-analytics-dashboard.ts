import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { analyticsApi } from '../../entities/analytics/api';
import { ANALYTICS_ANOMALY_FILTER_ROLES, hasRole } from '../../shared/config/roles';
import type { UserRole } from '../../shared/types/common';
import type { AnalyticsPeriod, ManagementSeverity } from '../../shared/types/analytics';
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
  managementSeverity: ManagementSeverity | '';
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
  now.setMinutes(0, 0, 0);
  const end = new Date(now);

  if (period === 'day') {
    end.setDate(end.getDate() + 1);
  } else if (period === 'week') {
    end.setDate(end.getDate() + 7);
  } else {
    end.setDate(end.getDate() + 30);
  }

  return {
    from: now.toISOString(),
    to: end.toISOString(),
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

  const forecastWindow = useMemo(
    () => resolveForecastWindow(filters.period, normalizedFrom, normalizedTo),
    [filters.period, normalizedFrom, normalizedTo],
  );

  const anomalyParams = {
    from: normalizedFrom,
    to: normalizedTo,
    parking_lot_id: filters.parkingLotId ?? undefined,
    user_id: hasRole(role, ANALYTICS_ANOMALY_FILTER_ROLES) ? filters.anomalyUserId ?? undefined : undefined,
  };
  const managementWindow = useMemo(() => {
    if (normalizedFrom && normalizedTo) {
      return { dateFrom: normalizedFrom, dateTo: normalizedTo };
    }

    const end = new Date();
    const start = new Date(end);
    if (filters.period === 'day') {
      start.setDate(start.getDate() - 1);
    } else if (filters.period === 'week') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setDate(start.getDate() - 30);
    }

    return {
      dateFrom: start.toISOString(),
      dateTo: end.toISOString(),
    };
  }, [normalizedFrom, normalizedTo, filters.period]);

  const [summaryQuery, occupancyQuery, bookingsQuery, forecastQuery, anomaliesQuery, managementRecommendationsQuery] = useQueries({
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
      {
        queryKey: analyticsQueryKeys.managementRecommendations({
          parking_lot_id: filters.parkingLotId ?? undefined,
          date_from: managementWindow.dateFrom,
          date_to: managementWindow.dateTo,
          severity: filters.managementSeverity || undefined,
        }),
        queryFn: () =>
          analyticsApi.getManagementRecommendations({
            parking_lot_id: filters.parkingLotId ?? undefined,
            date_from: managementWindow.dateFrom,
            date_to: managementWindow.dateTo,
            severity: filters.managementSeverity || undefined,
          }),
      },
    ],
  });

  return {
    summaryQuery,
    occupancyQuery,
    bookingsQuery,
    forecastQuery,
    anomaliesQuery,
    managementRecommendationsQuery,
  };
}
