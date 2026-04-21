import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { DEFAULT_ROLE_ROUTE } from '../app/router/role-routes';
import { useAuth } from '../features/auth/use-auth';
import { useAuthActions } from '../features/auth/use-auth-actions';

interface LoginLocationState {
  from?: string;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, error, clearError } = useAuth();
  const { loginMutation } = useAuthActions();

  const returnTo = (location.state as LoginLocationState | null)?.from;

  const alertText = useMemo(() => {
    if (error?.type === 'unauthorized_session') {
      return 'Сессия истекла или недействительна. Войдите снова.';
    }

    if (error?.type === 'invalid_credentials' || loginMutation.isError) {
      return 'Неверный логин или пароль.';
    }

    if (error?.type === 'auth_error') {
      return error.message;
    }

    return null;
  }, [error, loginMutation.isError]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  if (isAuthenticated && user) {
    return <Navigate to={DEFAULT_ROLE_ROUTE[user.role]} replace />;
  }

  return (
    <Box maxWidth={440} mx="auto" mt={8}>
      <Paper sx={{ p: 3 }}>
        <Stack
          spacing={2}
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate(
              { username: email, password },
              {
                onSuccess: () => {
                  navigate(returnTo || '/');
                },
              },
            );
          }}
        >
          <Typography variant="h5">Вход в Smart Parking</Typography>
          <Typography variant="body2" color="text.secondary">
            Для демо используйте тестового пользователя с нужной ролью.
          </Typography>
          {alertText && <Alert severity="error">{alertText}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <TextField
            label="Пароль"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Выполняем вход...' : 'Войти'}
          </Button>
          <Button component={RouterLink} to="/register">
            Создать аккаунт
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
