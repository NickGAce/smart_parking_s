import { CircularProgress, Stack, Typography } from '@mui/material';

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} py={6}>
      <CircularProgress />
      <Typography color="text.secondary">{message}</Typography>
    </Stack>
  );
}
