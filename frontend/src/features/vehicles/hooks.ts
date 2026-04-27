import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { vehiclesApi } from '../../entities/vehicles/api';
import type { ApiError } from '../../shared/types/common';
import type { Vehicle, VehicleCreatePayload, VehicleUpdatePayload } from '../../shared/types/vehicle';

const vehiclesQueryKeys = {
  all: ['vehicles'] as const,
};

export function useVehiclesQuery() {
  return useQuery({
    queryKey: vehiclesQueryKeys.all,
    queryFn: vehiclesApi.getVehicles,
  });
}

export function useCreateVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation<Vehicle, ApiError, VehicleCreatePayload>({
    mutationFn: vehiclesApi.createVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKeys.all });
    },
  });
}

export function useUpdateVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation<Vehicle, ApiError, { id: number; payload: VehicleUpdatePayload }>({
    mutationFn: ({ id, payload }) => vehiclesApi.updateVehicle(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKeys.all });
    },
  });
}

export function useDeleteVehicleMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, number>({
    mutationFn: vehiclesApi.deleteVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKeys.all });
    },
  });
}
