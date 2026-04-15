import type { ParkingSpotsQuery } from '../../shared/types/parking';

export const parkingSpotsQueryKeys = {
  all: ['parking-spots'] as const,
  lists: () => [...parkingSpotsQueryKeys.all, 'list'] as const,
  list: (params: ParkingSpotsQuery) => [...parkingSpotsQueryKeys.lists(), params] as const,
  details: () => [...parkingSpotsQueryKeys.all, 'detail'] as const,
  detail: (parkingSpotId: number) => [...parkingSpotsQueryKeys.details(), parkingSpotId] as const,
};
