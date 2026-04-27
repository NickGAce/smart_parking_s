import type { BookingStatus, NotificationStatus, SpotEffectiveStatus } from '../types/common';

type StatusColor = 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';

export interface StatusMeta {
  label: string;
  color: StatusColor;
}

export const bookingStatusMap: Record<BookingStatus, StatusMeta> = {
  pending: { label: 'Ожидает подтверждения', color: 'warning' },
  confirmed: { label: 'Подтверждено', color: 'info' },
  active: { label: 'Активно', color: 'primary' },
  completed: { label: 'Завершено', color: 'success' },
  cancelled: { label: 'Отменено', color: 'default' },
  expired: { label: 'Просрочено', color: 'error' },
  no_show: { label: 'Неявка', color: 'error' },
};

export const effectiveStatusMap: Record<SpotEffectiveStatus, StatusMeta> = {
  available: { label: 'Доступно', color: 'success' },
  booked: { label: 'Занято', color: 'warning' },
  blocked: { label: 'Заблокировано', color: 'error' },
};

export const notificationStatusMap: Record<NotificationStatus, StatusMeta> = {
  unread: { label: 'Не прочитано', color: 'warning' },
  read: { label: 'Прочитано', color: 'default' },
};
