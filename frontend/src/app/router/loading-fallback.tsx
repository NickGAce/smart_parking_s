import { CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingFallback() {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} py={10}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Загрузка приложения...
      </Typography>
    </Stack>
  );
}
