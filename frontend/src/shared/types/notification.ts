import type { PaginatedResponse } from './common';

export type NotificationStatus = 'unread' | 'read';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
}

export type NotificationListResponse = PaginatedResponse<NotificationItem>;
