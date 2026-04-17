import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

import { ContentCard } from './content-card';

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  helperText?: ReactNode;
}

export function MetricCard({ label, value, helperText }: MetricCardProps) {
  return (
    <ContentCard sx={{ p: 2 }}>
      <Stack spacing={0.5} minWidth={0}>
        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
          {label}
        </Typography>
        <Typography variant="h4" sx={{ lineHeight: 1.1, wordBreak: 'break-word' }}>
          {value}
        </Typography>
        {helperText ? (
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {helperText}
          </Typography>
        ) : null}
      </Stack>
    </ContentCard>
  );
}
