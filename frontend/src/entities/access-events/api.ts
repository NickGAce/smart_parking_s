import { httpClient } from '../../shared/api/http-client';
import { buildQueryParams } from '../../shared/api/query-params';
import type { QueryParams } from '../../shared/api/query-params';
import type {
  AccessEvent,
  AccessEventListResponse,
  AccessEventManualPayload,
  AccessEventRecognizePayload,
  AccessEventsQuery,
} from '../../shared/types/access-event';

export const accessEventsApi = {
  recognize: async (payload: AccessEventRecognizePayload): Promise<AccessEvent> => {
    const { data } = await httpClient.post<AccessEvent>('/access-events/recognize', payload);
    return data;
  },
  createManual: async (payload: AccessEventManualPayload): Promise<AccessEvent> => {
    const { data } = await httpClient.post<AccessEvent>('/access-events/manual', payload);
    return data;
  },
  getAccessEvents: async (params?: AccessEventsQuery): Promise<AccessEventListResponse> => {
    const { data } = await httpClient.get<AccessEventListResponse>('/access-events', {
      params,
      paramsSerializer: (queryParams) => buildQueryParams(queryParams as QueryParams).toString(),
    });
    return data;
  },
  getAccessEventById: async (eventId: number): Promise<AccessEvent> => {
    const { data } = await httpClient.get<AccessEvent>(`/access-events/${eventId}`);
    return data;
  },
};
