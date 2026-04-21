import type { ApiError } from '../../shared/types/common';

export function bookingApiErrorMessage(error: ApiError | Error | null | undefined, fallback: string): string {
  if (!error) {
    return fallback;
  }

  const maybeApiError = error as ApiError;

  if (maybeApiError.detail) {
    return maybeApiError.detail;
  }

  if (maybeApiError.fieldErrors?.length) {
    return maybeApiError.fieldErrors.map((item) => `${item.loc.join('.')} — ${item.msg}`).join('; ');
  }

  return error.message || fallback;
}

const lifecycleErrorHints: Array<{ matchesAny: string[]; message: string }> = [
  {
    matchesAny: ['check-in window', 'check in window', 'window is closed', 'not open yet'],
    message: 'Окно регистрации заезда закрыто: операция доступна только в разрешённый интервал.',
  },
  {
    matchesAny: ['too late', 'booking ended', 'window closed'],
    message: 'Слишком поздно для операции: бронирование уже вышло за допустимое время.',
  },
  {
    matchesAny: ['not active', 'not confirmed', 'invalid status'],
    message: 'Операция недоступна: бронирование должно быть в статусе «Подтверждено» или «Активно».',
  },
  {
    matchesAny: ['grace period', 'too early for no-show', 'grace period not passed'],
    message: 'Льготное время ещё не прошло: отметка «Не заехал» станет доступна позже.',
  },
];

export function bookingLifecycleErrorMessage(error: ApiError | Error | null | undefined, fallback: string): string {
  const baseMessage = bookingApiErrorMessage(error, fallback);
  const normalized = baseMessage.toLowerCase();

  const hint = lifecycleErrorHints.find((item) => item.matchesAny.some((match) => normalized.includes(match)));
  if (hint) {
    return hint.message;
  }

  return baseMessage;
}
