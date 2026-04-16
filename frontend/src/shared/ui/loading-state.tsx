import { CircularProgress, Stack, Typography } from '@mui/material';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({ message = 'Loading...', fullScreen = false }: LoadingStateProps) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} py={6} minHeight={fullScreen ? '100vh' : undefined}>
      <CircularProgress />
      <Typography color="text.secondary">{message}</Typography>
    </Stack>
  );
}
