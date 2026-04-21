import { Paper, Stack, Typography } from '@mui/material';

export function AdminPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Администрирование</Typography>
        <Typography color="text.secondary">Страница-заглушка для административных функций.</Typography>
      </Stack>
    </Paper>
  );
}
