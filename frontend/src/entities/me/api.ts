import { httpClient } from '../../shared/api/http-client';
import type { User } from '../../shared/types/auth';

export const meApi = {
  getMe: async (): Promise<User> => {
    const { data } = await httpClient.get<User>('/me');
    return data;
  },
};
