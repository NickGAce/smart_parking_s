import { httpClient } from '../../shared/api/http-client';
import type { Notification, NotificationListResponse, NotificationsQuery } from '../../shared/types/notification';

export const notificationsApi = {
  getNotifications: async (params?: NotificationsQuery): Promise<NotificationListResponse> => {
    const { data } = await httpClient.get<NotificationListResponse>('/notifications', { params });
    return data;
  },
  markRead: async (notificationId: number): Promise<Notification> => {
    const { data } = await httpClient.patch<Notification>(`/notifications/${notificationId}/read`);
    return data;
  },
};
