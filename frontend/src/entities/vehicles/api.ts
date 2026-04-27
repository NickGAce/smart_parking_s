import { httpClient } from '../../shared/api/http-client';
import type { Vehicle, VehicleCreatePayload, VehicleUpdatePayload } from '../../shared/types/vehicle';

export const vehiclesApi = {
  getVehicles: async (): Promise<Vehicle[]> => {
    const { data } = await httpClient.get<Vehicle[]>('/vehicles');
    return data;
  },
  createVehicle: async (payload: VehicleCreatePayload): Promise<Vehicle> => {
    const { data } = await httpClient.post<Vehicle>('/vehicles', payload);
    return data;
  },
  updateVehicle: async (id: number, payload: VehicleUpdatePayload): Promise<Vehicle> => {
    const { data } = await httpClient.patch<Vehicle>(`/vehicles/${id}`, payload);
    return data;
  },
  deleteVehicle: async (id: number): Promise<void> => {
    await httpClient.delete(`/vehicles/${id}`);
  },
};
