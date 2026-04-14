import { httpClient } from '../../shared/api/http-client';
import type {
  CreateParkingLotPayload,
  ParkingLot,
  ParkingLotListResponse,
  ParkingLotRules,
  ParkingLotsQuery,
  ParkingSpotListResponse,
  ParkingSpotsQuery,
  UpdateParkingLotPayload,
} from '../../shared/types/parking';

export const parkingApi = {
  getLots: async (params?: ParkingLotsQuery): Promise<ParkingLotListResponse> => {
    const { data } = await httpClient.get<ParkingLotListResponse>('/parking', { params });
    return data;
  },
  getLotById: async (parkingLotId: number): Promise<ParkingLot> => {
    const { data } = await httpClient.get<ParkingLot>(`/parking/${parkingLotId}`);
    return data;
  },
  createLot: async (payload: CreateParkingLotPayload): Promise<ParkingLot> => {
    const { data } = await httpClient.post<ParkingLot>('/parking', payload);
    return data;
  },
  updateLot: async (parkingLotId: number, payload: UpdateParkingLotPayload): Promise<ParkingLot> => {
    const { data } = await httpClient.patch<ParkingLot>(`/parking/${parkingLotId}`, payload);
    return data;
  },
  deleteLot: async (parkingLotId: number): Promise<void> => {
    await httpClient.delete(`/parking/${parkingLotId}`);
  },
  getRules: async (parkingLotId: number): Promise<ParkingLotRules> => {
    const { data } = await httpClient.get<ParkingLotRules>(`/parking/${parkingLotId}/rules`);
    return data;
  },
  replaceRules: async (
    parkingLotId: number,
    payload: Omit<ParkingLotRules, 'parking_lot_id'>,
  ): Promise<ParkingLotRules> => {
    const { data } = await httpClient.put<ParkingLotRules>(`/parking/${parkingLotId}/rules`, payload);
    return data;
  },
  // Backward-compatible call location for existing hooks.
  getSpots: async (params?: ParkingSpotsQuery): Promise<ParkingSpotListResponse> => {
    const { data } = await httpClient.get<ParkingSpotListResponse>('/parking_spots', { params });
    return data;
  },
};
