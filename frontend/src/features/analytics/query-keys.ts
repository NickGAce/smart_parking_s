import type { AnalyticsQuery, ForecastQuery, ForecastQualityQuery } from '../../shared/types/analytics';

export const analyticsQueryKeys = {
  all: ['analytics'] as const,
  summary: (params?: AnalyticsQuery) => [...analyticsQueryKeys.all, 'summary', params ?? {}] as const,
  occupancy: (params?: AnalyticsQuery) => [...analyticsQueryKeys.all, 'occupancy', params ?? {}] as const,
  bookings: (params?: AnalyticsQuery) => [...analyticsQueryKeys.all, 'bookings', params ?? {}] as const,
  forecast: (params?: ForecastQuery) => [...analyticsQueryKeys.all, 'forecast', params ?? {}] as const,
  forecastQuality: (params: ForecastQualityQuery) => [...analyticsQueryKeys.all, 'forecast-quality', params] as const,
  anomalies: (params?: { from?: string; to?: string; parking_lot_id?: number; user_id?: number }) =>
    [...analyticsQueryKeys.all, 'anomalies', params ?? {}] as const,
  managementRecommendations: (params: { date_from: string; date_to: string; parking_lot_id?: number; severity?: string }) =>
    [...analyticsQueryKeys.all, 'management-recommendations', params] as const,
};
