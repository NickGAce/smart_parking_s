/* eslint-disable react-refresh/only-export-components */
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from '../../entities/auth/api';
import { meApi } from '../../entities/me/api';
import { tokenStorage } from '../../shared/api/token-storage';
import type { ApiError } from '../../shared/types/common';
import type { LoginPayload, RegisterPayload, User } from '../../shared/types/auth';

export type AuthErrorType = 'auth_error' | 'invalid_credentials' | 'unauthorized_session';

export interface AuthErrorState {
  type: AuthErrorType;
  message: string;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: AuthErrorState | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toAuthError = (error: unknown, fallbackMessage: string): AuthErrorState => {
  const apiError = error as ApiError;

  if (apiError?.status === 401) {
    return {
      type: 'invalid_credentials',
      message: 'Неверные учетные данные. Проверьте email и пароль.',
    };
  }

  return {
    type: 'auth_error',
    message: apiError?.message ?? fallbackMessage,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [error, setError] = useState<AuthErrorState | null>(null);

  useEffect(() => {
    const token = tokenStorage.get();

    if (!token) {
      setStatus('unauthenticated');
      return;
    }

    setAccessToken(token);
    void meApi
      .getMe()
      .then((me) => {
        setUser(me);
        setStatus('authenticated');
        setError(null);
      })
      .catch(() => {
        tokenStorage.clear();
        setAccessToken(null);
        setUser(null);
        setStatus('unauthenticated');
        setError({
          type: 'unauthorized_session',
          message: 'Сессия недействительна. Войдите снова.',
        });
      });
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setStatus('loading');
    setError(null);

    try {
      const token = await authApi.login(payload);
      tokenStorage.set(token.access_token);
      setAccessToken(token.access_token);
      const me = await meApi.getMe();
      setUser(me);
      setStatus('authenticated');
    } catch (loginError) {
      tokenStorage.clear();
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
      setError(toAuthError(loginError, 'Не удалось войти в систему.'));
      throw loginError;
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    setError(null);

    try {
      await authApi.register(payload);
      await login({ username: payload.email, password: payload.password });
    } catch (registerError) {
      setError(toAuthError(registerError, 'Не удалось зарегистрировать пользователя.'));
      throw registerError;
    }
  }, [login]);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setAccessToken(null);
    setUser(null);
    setError(null);
    setStatus('unauthenticated');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      status,
      error,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      login,
      register,
      logout,
      clearError,
    }),
    [accessToken, clearError, error, login, logout, register, status, user],
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
