import type { ReactNode } from 'react';
import { Typography } from '@mui/material';

interface InlineFieldHintProps {
  children: ReactNode;
}

export function InlineFieldHint({ children }: InlineFieldHintProps) {
  return (
    <Typography component="span" variant="caption" color="text.secondary">
      {children}
    </Typography>
  );
}

interface ValidationMessageProps {
  message?: string | null;
}

export function ValidationMessage({ message }: ValidationMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <Typography component="span" variant="caption" color="error.main" sx={{ fontWeight: 500 }}>
      {message}
    </Typography>
  );
}
