import { useMutation } from '@tanstack/react-query';

import type { UpdateUserRolePayload } from '../../entities/user/api';
import { userApi } from '../../entities/user/api';

interface UpdateUserRoleArgs {
  userId: number;
  payload: UpdateUserRolePayload;
}

export function useUpdateUserRoleMutation() {
  return useMutation({
    mutationFn: ({ userId, payload }: UpdateUserRoleArgs) => userApi.updateUserRole(userId, payload),
  });
}
