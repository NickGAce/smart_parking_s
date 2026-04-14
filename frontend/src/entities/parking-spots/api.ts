import { httpClient } from '../../shared/api/http-client';
import type {
  CreateParkingSpotPayload,
  ParkingSpot,
  ParkingSpotListResponse,
  ParkingSpotsQuery,
  UpdateParkingSpotPayload,
} from '../../shared/types/parking';

export const parkingSpotsApi = {
  getSpots: async (params?: ParkingSpotsQuery): Promise<ParkingSpotListResponse> => {
    const { data } = await httpClient.get<ParkingSpotListResponse>('/parking_spots', { params });
    return data;
  },
  getSpotById: async (parkingSpotId: number): Promise<ParkingSpot> => {
    const { data } = await httpClient.get<ParkingSpot>(`/parking_spots/${parkingSpotId}`);
    return data;
  },
  createSpot: async (payload: CreateParkingSpotPayload): Promise<ParkingSpot> => {
    const { data } = await httpClient.post<ParkingSpot>('/parking_spots', payload);
    return data;
  },
  updateSpot: async (parkingSpotId: number, payload: UpdateParkingSpotPayload): Promise<ParkingSpot> => {
    const { data } = await httpClient.patch<ParkingSpot>(`/parking_spots/${parkingSpotId}`, payload);
    return data;
  },
  deleteSpot: async (parkingSpotId: number): Promise<void> => {
    await httpClient.delete(`/parking_spots/${parkingSpotId}`);
  },
};
