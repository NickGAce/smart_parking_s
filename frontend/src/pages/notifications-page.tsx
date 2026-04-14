import { Paper, Stack, Typography } from '@mui/material';

export function NotificationsPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Notifications</Typography>
        <Typography color="text.secondary">Страница-заглушка для уведомлений.</Typography>
      </Stack>
    </Paper>
  );
}
