import { httpClient } from '../../shared/api/http-client';
import type {
  AnalyticsBookings,
  AnalyticsOccupancy,
  AnalyticsQuery,
  AnalyticsSummary,
  AnomaliesResponse,
  ForecastQuery,
  ManagementRecommendationsQuery,
  ManagementRecommendationsResponse,
  OccupancyForecast,
} from '../../shared/types/analytics';

export const analyticsApi = {
  getSummary: async (params?: AnalyticsQuery): Promise<AnalyticsSummary> => {
    const { data } = await httpClient.get<AnalyticsSummary>('/analytics/summary', { params });
    return data;
  },
  getOccupancy: async (params?: AnalyticsQuery): Promise<AnalyticsOccupancy> => {
    const { data } = await httpClient.get<AnalyticsOccupancy>('/analytics/occupancy', { params });
    return data;
  },
  getBookings: async (params?: AnalyticsQuery): Promise<AnalyticsBookings> => {
    const { data } = await httpClient.get<AnalyticsBookings>('/analytics/bookings', { params });
    return data;
  },
  getOccupancyForecast: async (params?: ForecastQuery): Promise<OccupancyForecast> => {
    const { data } = await httpClient.get<OccupancyForecast>('/analytics/occupancy-forecast', { params });
    return data;
  },
  getAnomalies: async (params?: Pick<ForecastQuery, 'from' | 'to' | 'parking_lot_id'> & { user_id?: number }): Promise<AnomaliesResponse> => {
    const { data } = await httpClient.get<AnomaliesResponse>('/analytics/anomalies', { params });
    return data;
  },
  getManagementRecommendations: async (
    params: ManagementRecommendationsQuery,
  ): Promise<ManagementRecommendationsResponse> => {
    const { data } = await httpClient.get<ManagementRecommendationsResponse>('/analytics/management-recommendations', { params });
    return data;
  },
};
