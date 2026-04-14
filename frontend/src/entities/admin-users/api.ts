import { httpClient } from '../../shared/api/http-client';
import type { User } from '../../shared/types/auth';

export interface AdminCreateUserPayload {
  email: string;
  password: string;
  role: User['role'];
}

export interface UpdateUserRolePayload {
  role: User['role'];
}

export const userApi = {
  createUser: async (payload: AdminCreateUserPayload): Promise<User> => {
    const { data } = await httpClient.post<User>('/admin/users', payload);
    return data;
  },
  updateUserRole: async (userId: number, payload: UpdateUserRolePayload): Promise<User> => {
    const { data } = await httpClient.patch<User>(`/admin/users/${userId}`, payload);
    return data;
  },
};
