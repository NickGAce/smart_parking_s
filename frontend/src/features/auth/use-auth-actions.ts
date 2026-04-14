import { useMutation } from '@tanstack/react-query';

import { useAuth } from '../../app/providers/auth-provider';
import type { LoginPayload, RegisterPayload } from '../../shared/types/auth';

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
