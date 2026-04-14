import { useQuery } from '@tanstack/react-query';

import { parkingApi } from '../../entities/parking/api';

export function useParkingLotsQuery() {
  return useQuery({
    queryKey: ['parking-lots'],
    queryFn: parkingApi.getLots,
  });
}
