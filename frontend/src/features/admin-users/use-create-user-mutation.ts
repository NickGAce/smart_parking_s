import { useMutation } from '@tanstack/react-query';

import type { AdminCreateUserPayload } from '../../entities/user/api';
import { userApi } from '../../entities/user/api';

export function useCreateUserMutation() {
  return useMutation({
    mutationFn: (payload: AdminCreateUserPayload) => userApi.createUser(payload),
  });
}
