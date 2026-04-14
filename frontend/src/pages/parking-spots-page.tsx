import { Paper, Stack, Typography } from '@mui/material';

export function ParkingSpotsPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Parking spots</Typography>
        <Typography color="text.secondary">Страница-заглушка для парковочных мест.</Typography>
      </Stack>
    </Paper>
  );
}
