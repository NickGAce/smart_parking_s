import { useQuery } from '@tanstack/react-query';

import { parkingApi } from '../../entities/parking/api';

export function useParkingSpotsQuery() {
  return useQuery({
    queryKey: ['parking-spots'],
    queryFn: parkingApi.getSpots,
  });
}
