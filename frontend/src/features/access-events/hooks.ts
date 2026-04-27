import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accessEventsApi } from '../../entities/access-events/api';
import type {
  AccessEvent,
  AccessEventManualPayload,
  AccessEventRecognizePayload,
  AccessEventsQuery,
} from '../../shared/types/access-event';
import type { ApiError } from '../../shared/types/common';

const accessEventsQueryKeys = {
  all: ['access-events'] as const,
  list: (params?: AccessEventsQuery) => [...accessEventsQueryKeys.all, 'list', params ?? {}] as const,
  latest: () => [...accessEventsQueryKeys.all, 'latest'] as const,
};

export function useAccessEventsQuery(params?: AccessEventsQuery) {
  return useQuery({
    queryKey: accessEventsQueryKeys.list(params),
    queryFn: () => accessEventsApi.getAccessEvents(params),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useLatestAccessEventsQuery(limit = 5) {
  return useQuery({
    queryKey: accessEventsQueryKeys.latest(),
    queryFn: () => accessEventsApi.getAccessEvents({ limit, offset: 0 }),
    refetchInterval: 30_000,
  });
}

export function useManualAccessEventMutation() {
  const queryClient = useQueryClient();
  return useMutation<AccessEvent, ApiError, AccessEventManualPayload>({
    mutationFn: (payload) => accessEventsApi.createManual(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessEventsQueryKeys.all });
    },
  });
}

export function useRecognizeAccessEventMutation() {
  const queryClient = useQueryClient();
  return useMutation<AccessEvent, ApiError, AccessEventRecognizePayload>({
    mutationFn: (payload) => accessEventsApi.recognize(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessEventsQueryKeys.all });
    },
  });
}
