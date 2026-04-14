import { Alert, Paper, Stack, Typography } from '@mui/material';

import { useCurrentUser } from '../features/auth/use-current-user';

export function DashboardPage() {
  const { user } = useCurrentUser();

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Dashboard</Typography>
        <Typography color="text.secondary">
          Базовая заглушка дашборда. Контент будет зависеть от роли пользователя.
        </Typography>
        <Alert severity="info">Текущий пользователь: {user?.email} ({user?.role}).</Alert>
      </Stack>
    </Paper>
  );
}
