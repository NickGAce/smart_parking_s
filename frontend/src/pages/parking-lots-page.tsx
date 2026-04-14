import { Paper, Stack, Typography } from '@mui/material';

export function ParkingLotsPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Parking lots</Typography>
        <Typography color="text.secondary">Страница-заглушка для списка парковок.</Typography>
      </Stack>
    </Paper>
  );
}
