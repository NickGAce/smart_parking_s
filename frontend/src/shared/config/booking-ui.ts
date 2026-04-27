import type { BookingType, BookingsQuery } from '../types/booking';
import type { BookingStatus, SortOrder } from '../types/common';

export const bookingStatusLabelMap: Record<BookingStatus, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждено',
  active: 'Активно',
  completed: 'Завершено',
  cancelled: 'Отменено',
  expired: 'Просрочено',
  no_show: 'Не заехал',
};

export const bookingSortByLabelMap: Record<NonNullable<BookingsQuery['sort_by']>, string> = {
  id: 'ID бронирования',
  start_time: 'Время начала',
  end_time: 'Время окончания',
  status: 'Статус',
};

export const bookingSortOrderLabelMap: Record<SortOrder, string> = {
  asc: 'По возрастанию',
  desc: 'По убыванию',
};

export const bookingTypeLabelMap: Record<BookingType, string> = {
  rental: 'Аренда',
  guest: 'Гость',
};

export const bookingAssignmentModeLabelMap: Record<string, string> = {
  manual: 'Ручной выбор места',
  auto: 'Автоподбор места',
};

export function formatBookingDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatBookingInterval(start: string, end: string): string {
  return `${formatBookingDateTime(start)} — ${formatBookingDateTime(end)}`;
}

export function formatBookingDurationLabel(start: string, end: string): string {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours > 0 && restMinutes > 0) {
    return `${hours} ч ${restMinutes} мин`;
  }

  if (hours > 0) {
    return `${hours} ч`;
  }

  return `${restMinutes} мин`;
}
