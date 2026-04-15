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
  const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
  if (!candidate) {
    return toFixedOffsetTimezone();
  }

  // Backend supports IANA zone IDs and fixed offsets.
  // Keep IANA as-is; fallback to fixed offset for unknown browser formats.
  if (candidate.includes('/')) {
    return candidate;
  }

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
