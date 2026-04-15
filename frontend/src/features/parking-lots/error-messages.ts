import { adaptApiError } from '../../shared/api/error-adapter';

export function parkingApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = adaptApiError(error);

  if (apiError.status === 403) {
    return 'У вас нет прав для этого действия (403).';
  }

  if (apiError.status === 404) {
    return 'Сущность не найдена (404). Возможно, парковка была удалена.';
  }

  if (apiError.status === 422) {
    return 'Ошибка валидации (422). Проверьте заполнение полей.';
  }

  if (apiError.status === 409) {
    return apiError.detail ? `Конфликт бизнес-правил: ${apiError.detail}` : 'Конфликт бизнес-правил (409).';
  }

  return apiError.detail ?? apiError.message ?? fallback;
}
