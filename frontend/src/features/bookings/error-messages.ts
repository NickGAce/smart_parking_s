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
