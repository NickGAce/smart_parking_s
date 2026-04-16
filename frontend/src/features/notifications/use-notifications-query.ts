import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationApi } from '../../entities/notification/api';
import type { Notification, NotificationsQuery } from '../../shared/types/notification';
import type { ApiError } from '../../shared/types/common';

const notificationsQueryKeys = {
  all: ['notifications'] as const,
  list: (params?: NotificationsQuery) => [...notificationsQueryKeys.all, 'list', params ?? {}] as const,
  unreadCount: () => [...notificationsQueryKeys.all, 'unread-count'] as const,
};

const NOTIFICATIONS_POLLING_MS = 60_000;

export function useNotificationsQuery(params?: NotificationsQuery) {
  return useQuery({
    queryKey: notificationsQueryKeys.list(params),
    queryFn: () => notificationApi.getNotifications(params),
    refetchInterval: NOTIFICATIONS_POLLING_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });
}

export function useUnreadNotificationsCountQuery() {
  return useQuery({
    queryKey: notificationsQueryKeys.unreadCount(),
    queryFn: () => notificationApi.getNotifications({ status: 'unread', limit: 1, offset: 0 }),
    select: (response) => response.meta.total,
    refetchInterval: NOTIFICATIONS_POLLING_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation<Notification, ApiError, number>({
    mutationFn: (notificationId) => notificationApi.markRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.all });
      await queryClient.refetchQueries({ queryKey: notificationsQueryKeys.all, type: 'active' });
    },
  });
}
