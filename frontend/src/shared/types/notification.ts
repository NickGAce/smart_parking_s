import type { ListResponse, NotificationStatus, NotificationType } from './common';

export interface Notification {
  id: number;
  user_id: number;
  booking_id: number | null;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface NotificationsQuery {
  status?: NotificationStatus;
  limit?: number;
  offset?: number;
}

export type NotificationListResponse = ListResponse<Notification>;
