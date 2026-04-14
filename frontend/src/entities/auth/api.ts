import { httpClient } from '../../shared/api/http-client';
import type { AuthToken, LoginPayload, RegisterPayload, User } from '../../shared/types/auth';

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthToken> => {
    const params = new URLSearchParams();
    params.set('username', payload.username);
    params.set('password', payload.password);

    const { data } = await httpClient.post<AuthToken>('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return data;
  },
  register: async (payload: RegisterPayload): Promise<User> => {
    const { data } = await httpClient.post<User>('/auth/register', payload);
    return data;
  },
  // Backward compatibility while meApi is adopted incrementally.
  getMe: async (): Promise<User> => {
    const { data } = await httpClient.get<User>('/me');
    return data;
  },
};
