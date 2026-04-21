import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { parkingApi } from '../../entities/parking/api';
import type { CreateParkingLotPayload, ParkingLotRules, ParkingLotsQuery, UpdateParkingLotPayload } from '../../shared/types/parking';

export const parkingLotsQueryKey = ['parking-lots'] as const;

export function useParkingLotsQuery(params: ParkingLotsQuery) {
  return useQuery({
    queryKey: [...parkingLotsQueryKey, params],
    queryFn: () => parkingApi.getLots(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });
}

export function useParkingLotQuery(parkingLotId: number) {
  return useQuery({
    queryKey: [...parkingLotsQueryKey, parkingLotId],
    queryFn: () => parkingApi.getLotById(parkingLotId),
    enabled: Number.isFinite(parkingLotId) && parkingLotId > 0,
  });
}

export function useParkingLotRulesQuery(parkingLotId: number) {
  return useQuery({
    queryKey: [...parkingLotsQueryKey, parkingLotId, 'rules'],
    queryFn: () => parkingApi.getRules(parkingLotId),
    enabled: Number.isFinite(parkingLotId) && parkingLotId > 0,
  });
}

export function useCreateParkingLotMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateParkingLotPayload) => parkingApi.createLot(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingLotsQueryKey });
    },
  });
}

export function useUpdateParkingLotMutation(parkingLotId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateParkingLotPayload) => parkingApi.updateLot(parkingLotId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingLotsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...parkingLotsQueryKey, parkingLotId] });
    },
  });
}

export function useReplaceParkingLotRulesMutation(parkingLotId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Omit<ParkingLotRules, 'parking_lot_id'>) => parkingApi.replaceRules(parkingLotId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: parkingLotsQueryKey });
      void queryClient.invalidateQueries({ queryKey: [...parkingLotsQueryKey, parkingLotId] });
      void queryClient.invalidateQueries({ queryKey: [...parkingLotsQueryKey, parkingLotId, 'rules'] });
    },
  });
}
