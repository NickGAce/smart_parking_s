import axios from 'axios';

import { API_BASE_URL } from '../config/env';
import { adaptApiError } from './error-adapter';
import { withTimezoneHeader } from './timezone';
import { tokenStorage } from './token-storage';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
});

httpClient.interceptors.request.use((config) => {
  const nextConfig = withTimezoneHeader(config);
  const token = tokenStorage.get();

  if (token) {
    nextConfig.headers.Authorization = `Bearer ${token}`;
  }

  return nextConfig;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(adaptApiError(error)),
);
