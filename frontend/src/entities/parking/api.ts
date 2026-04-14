import { httpClient } from '../../shared/api/http-client';
import type { ParkingLotListResponse, ParkingSpotListResponse } from '../../shared/types/parking';

export const parkingApi = {
  getLots: async (): Promise<ParkingLotListResponse> => {
    const { data } = await httpClient.get<ParkingLotListResponse>('/parking');
    return data;
  },
  getSpots: async (): Promise<ParkingSpotListResponse> => {
    const { data } = await httpClient.get<ParkingSpotListResponse>('/parking_spots');
    return data;
  },
};
