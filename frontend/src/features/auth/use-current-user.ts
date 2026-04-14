import { useAuth } from './use-auth';

export function useCurrentUser() {
  const { user, status, isAuthenticated, isLoading } = useAuth();

  return {
    user,
    role: user?.role,
    status,
    isAuthenticated,
    isLoading,
  };
}
