import { useMutation } from '@tanstack/react-query';

import type { LoginPayload, RegisterPayload } from '../../shared/types/auth';
import { useAuth } from './use-auth';

export function useAuthActions() {
  const auth = useAuth();

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => auth.login(payload),
  });

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterPayload) => auth.register(payload),
  });

  return { loginMutation, registerMutation };
}
