import { CircularProgress, Skeleton, Stack, Typography } from '@mui/material';

import { stateMessages } from './state-messages';

type LoadingVariant = 'page' | 'section' | 'inline' | 'skeleton';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  variant?: LoadingVariant;
  lines?: number;
}

export function LoadingState({
  message,
  fullScreen = false,
  variant = 'section',
  lines = 4,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <Stack spacing={1.2} py={1}>
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={28} />
        ))}
      </Stack>
    );
  }

  const fallbackMessage = variant === 'page' ? stateMessages.loading.page : stateMessages.loading.section;

  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={2}
      py={variant === 'inline' ? 2 : 6}
      minHeight={fullScreen ? '100vh' : undefined}
    >
      <CircularProgress size={variant === 'inline' ? 20 : 28} />
      <Typography color="text.secondary">{message ?? fallbackMessage}</Typography>
    </Stack>
  );
}
