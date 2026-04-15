import type { AxiosRequestConfig } from 'axios';

function toFixedOffsetTimezone(): string {
  const minutesEast = -new Date().getTimezoneOffset();
  const sign = minutesEast >= 0 ? '+' : '-';
  const abs = Math.abs(minutesEast);
  const hours = Math.floor(abs / 60).toString().padStart(2, '0');
  const minutes = (abs % 60).toString().padStart(2, '0');
  return `UTC${sign}${hours}:${minutes}`;
}

export const getClientTimezone = (): string => {
  // Always send fixed UTC offset because backend environments may not have IANA
  // timezone database available, which can cause "Invalid X-Timezone header".
  return toFixedOffsetTimezone();
};

export const withTimezoneHeader = <T extends AxiosRequestConfig>(config?: T): T => {
  const nextConfig = { ...(config ?? {}) } as T;
  nextConfig.headers = {
    ...(nextConfig.headers ?? {}),
    'X-Timezone': getClientTimezone(),
  };
  return nextConfig;
};
