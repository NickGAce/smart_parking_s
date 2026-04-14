import { Paper, Stack, Typography } from '@mui/material';

export function BookingsPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Bookings</Typography>
        <Typography color="text.secondary">Страница-заглушка для бронирований.</Typography>
      </Stack>
    </Paper>
  );
}
