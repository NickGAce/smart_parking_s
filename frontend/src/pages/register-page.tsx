import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';

import { DEFAULT_ROLE_ROUTE } from '../app/router/role-routes';
import { useAuth } from '../features/auth/use-auth';
import { useAuthActions } from '../features/auth/use-auth-actions';

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isAuthenticated, user, error, clearError } = useAuth();
  const { registerMutation } = useAuthActions();

  const alertText = useMemo(() => {
    if (registerMutation.isError) {
      return error?.message ?? 'Не удалось зарегистрироваться. Попробуйте снова.';
    }

    return null;
  }, [error?.message, registerMutation.isError]);

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
            registerMutation.mutate({ email, password });
          }}
        >
          <Typography variant="h5">Register</Typography>
          {alertText && <Alert severity="error">{alertText}</Alert>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating...' : 'Create account'}
          </Button>
          <Button component={RouterLink} to="/login">
            Back to login
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
