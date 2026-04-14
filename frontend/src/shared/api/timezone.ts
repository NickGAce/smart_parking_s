import type { AxiosRequestConfig } from 'axios';

export const getClientTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const withTimezoneHeader = <T extends AxiosRequestConfig>(config?: T): T => {
  const nextConfig = { ...(config ?? {}) } as T;
  nextConfig.headers = {
    ...(nextConfig.headers ?? {}),
    'X-Timezone': getClientTimezone(),
  };
  return nextConfig;
};
