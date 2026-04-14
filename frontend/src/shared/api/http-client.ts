import axios from 'axios';

import { API_BASE_URL } from '../config/env';
import { tokenStorage } from './token-storage';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
});

httpClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  config.headers['X-Timezone'] = timezone;

  return config;
});
