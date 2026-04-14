import { Paper, Stack, Typography } from '@mui/material';

export function AnalyticsPage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={1.5}>
        <Typography variant="h4">Analytics</Typography>
        <Typography color="text.secondary">Страница-заглушка для аналитики.</Typography>
      </Stack>
    </Paper>
  );
}
