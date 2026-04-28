import { httpClient } from '../../shared/api/http-client';
import { buildQueryParams } from '../../shared/api/query-params';
import type { QueryParams } from '../../shared/api/query-params';
import type {
  AccessEvent,
  AccessEventListResponse,
  AccessEventManualPayload,
  AccessEventRecognizePayload,
  AccessEventRecognitionResponse,
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
  recognizeImage: async (payload: { file: File; parking_lot_id: number; direction: "entry" | "exit"; plate_hint?: string }): Promise<AccessEventRecognitionResponse> => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('parking_lot_id', String(payload.parking_lot_id));
    formData.append('direction', payload.direction);
    if (payload.plate_hint) formData.append('plate_hint', payload.plate_hint);
    const { data } = await httpClient.post<AccessEventRecognitionResponse>('/access-events/recognize/image', formData);
    return data;
  },
  recognizeVideo: async (payload: { file: File; parking_lot_id: number; direction: "entry" | "exit"; plate_hint?: string }): Promise<AccessEvent> => {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('parking_lot_id', String(payload.parking_lot_id));
    formData.append('direction', payload.direction);
    if (payload.plate_hint) formData.append('plate_hint', payload.plate_hint);
    const { data } = await httpClient.post<AccessEvent>('/access-events/recognize/video', formData);
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
