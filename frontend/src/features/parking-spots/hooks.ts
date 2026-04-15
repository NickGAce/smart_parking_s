import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { parkingSpotsApi } from '../../entities/parking-spots/api';
import type { CreateParkingSpotPayload, ParkingSpotsQuery, UpdateParkingSpotPayload } from '../../shared/types/parking';
import { parkingSpotsQueryKeys } from './query-keys';

export function useParkingSpotsQuery(params: ParkingSpotsQuery) {
  return useQuery({
    queryKey: parkingSpotsQueryKeys.list(params),
    queryFn: () => parkingSpotsApi.getSpots(params),
  });
}

export function useParkingSpotQuery(parkingSpotId: number) {
  return useQuery({
    queryKey: parkingSpotsQueryKeys.detail(parkingSpotId),
    queryFn: () => parkingSpotsApi.getSpotById(parkingSpotId),
    enabled: Number.isFinite(parkingSpotId) && parkingSpotId > 0,
  });
}

export function useCreateParkingSpotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateParkingSpotPayload) => parkingSpotsApi.createSpot(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.all });
    },
  });
}

export function useUpdateParkingSpotMutation(parkingSpotId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateParkingSpotPayload) => parkingSpotsApi.updateSpot(parkingSpotId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.detail(parkingSpotId) });
    },
  });
}

export function useDeleteParkingSpotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (parkingSpotId: number) => parkingSpotsApi.deleteSpot(parkingSpotId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingSpotsQueryKeys.all });
    },
  });
}
