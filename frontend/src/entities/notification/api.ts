import { httpClient } from '../../shared/api/http-client';
import type { NotificationListResponse } from '../../shared/types/notification';

export const notificationApi = {
  getNotifications: async (): Promise<NotificationListResponse> => {
    const { data } = await httpClient.get<NotificationListResponse>('/notifications');
    return data;
  },
};
