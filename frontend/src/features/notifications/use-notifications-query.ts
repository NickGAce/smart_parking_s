import { useQuery } from '@tanstack/react-query';

import { notificationApi } from '../../entities/notification/api';

export function useNotificationsQuery() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.getNotifications,
    refetchInterval: 30_000,
  });
}
