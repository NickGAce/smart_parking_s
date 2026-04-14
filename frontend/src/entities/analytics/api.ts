import { httpClient } from '../../shared/api/http-client';
import type { AnalyticsSummary } from '../../shared/types/analytics';

export const analyticsApi = {
  getSummary: async (): Promise<AnalyticsSummary> => {
    const { data } = await httpClient.get<AnalyticsSummary>('/analytics/summary');
    return data;
  },
};
