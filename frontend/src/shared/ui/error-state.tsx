import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import type { ReactNode } from 'react';
import { Alert, Button, Stack } from '@mui/material';

import { stateMessages } from './state-messages';

type ErrorVariant = 'recoverable' | 'destructive';

interface ErrorStateProps {
  message?: string;
  variant?: ErrorVariant;
  action?: ReactNode;
  onRetry?: () => void;
}

export function ErrorState({ message, variant = 'recoverable', action, onRetry }: ErrorStateProps) {
  const fallbackMessage = variant === 'destructive' ? stateMessages.error.destructive : stateMessages.error.recoverable;

  return (
    <Stack py={2}>
      <Alert
        icon={variant === 'destructive' ? <ReportProblemOutlinedIcon fontSize="inherit" /> : <ErrorOutlineIcon fontSize="inherit" />}
        severity="error"
        variant="outlined"
        action={action ?? (onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Повторить</Button> : undefined)}
      >
        {message ?? fallbackMessage}
      </Alert>
    </Stack>
  );
}
