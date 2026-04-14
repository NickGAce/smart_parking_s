import axios, { type AxiosError } from 'axios';

import type { ApiError, ApiErrorEnvelope, FastApiValidationErrorItem } from '../types/common';

const isValidationArray = (value: unknown): value is FastApiValidationErrorItem[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'object' && item !== null && 'msg' in item);

export const adaptApiError = (error: unknown): ApiError => {
  if (!axios.isAxiosError(error)) {
    return {
      message: 'Unexpected error',
      code: 'unknown_error',
      raw: error,
    };
  }

  const axiosError = error as AxiosError<ApiErrorEnvelope>;

  if (!axiosError.response) {
    return {
      message: axiosError.message || 'Network error',
      code: 'network_error',
      raw: axiosError,
    };
  }

  const { status, data } = axiosError.response;
  const detail = data?.detail;

  if (status === 422 && isValidationArray(detail)) {
    return {
      message: 'Validation error',
      status,
      code: 'validation_error',
      fieldErrors: detail,
      raw: axiosError,
    };
  }

  if (typeof detail === 'string') {
    return {
      message: detail,
      detail,
      status,
      code: 'http_error',
      raw: axiosError,
    };
  }

  return {
    message: axiosError.message || 'Request failed',
    status,
    code: 'http_error',
    raw: axiosError,
  };
};
