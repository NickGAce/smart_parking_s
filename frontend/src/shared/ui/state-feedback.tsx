import type { ReactNode } from 'react';
import { Alert, Stack } from '@mui/material';

interface StateFeedbackProps {
  severity: 'success' | 'info' | 'warning' | 'error';
  children: ReactNode;
}

export function StateFeedback({ severity, children }: StateFeedbackProps) {
  return (
    <Stack py={0.5}>
      <Alert
        severity={severity}
        variant="outlined"
        sx={{
          borderRadius: (theme) => theme.foundation.radius.sm,
          '& .MuiAlert-message': { width: '100%' },
        }}
      >
        {children}
      </Alert>
    </Stack>
  );
}
