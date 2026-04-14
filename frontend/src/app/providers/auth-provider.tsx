import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from '../../entities/auth/api';
import { meApi } from '../../entities/me/api';
import { tokenStorage } from '../../shared/api/token-storage';
import type { LoginPayload, RegisterPayload, User } from '../../shared/types/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = tokenStorage.get();

    if (!token) {
      setIsLoading(false);
      return;
    }

    void meApi
      .getMe()
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (payload: LoginPayload) => {
    const token = await authApi.login(payload);
    tokenStorage.set(token.access_token);
    const me = await meApi.getMe();
    setUser(me);
  };

  const register = async (payload: RegisterPayload) => {
    await authApi.register(payload);
    await login({ username: payload.email, password: payload.password });
  };

  const logout = () => {
    tokenStorage.clear();
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
