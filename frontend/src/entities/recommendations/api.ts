import { httpClient } from '../../shared/api/http-client';
import type { RecommendationRequestPayload, RecommendationResult } from '../../shared/types/recommendation';

export const recommendationsApi = {
  getSpotRecommendations: async (payload: RecommendationRequestPayload): Promise<RecommendationResult> => {
    const { data } = await httpClient.post<RecommendationResult>('/recommendations/spots', payload);
    return data;
  },
};
