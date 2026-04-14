import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';

import { useAuth } from '../app/providers/auth-provider';
import { useAuthActions } from '../features/auth/use-auth-actions';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isAuthenticated } = useAuth();
  const { loginMutation } = useAuthActions();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box maxWidth={420} mx="auto" mt={8}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} component="form" onSubmit={(e) => {
          e.preventDefault();
          loginMutation.mutate({ username: email, password });
        }}>
          <Typography variant="h5">Login</Typography>
          {loginMutation.isError && <Alert severity="error">Не удалось войти.</Alert>}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={loginMutation.isPending}>
            Sign in
          </Button>
          <Button component={RouterLink} to="/register">Create account</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
