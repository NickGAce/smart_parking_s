import type { ReactNode } from 'react';
import { Stack, Typography, type SxProps, type Theme } from '@mui/material';

import { ContentCard } from './content-card';

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  helperText?: ReactNode;
  sx?: SxProps<Theme>;
}

export function MetricCard({ label, value, helperText, sx }: MetricCardProps) {
  return (
    <ContentCard
      sx={{
        p: 2,
        borderRadius: (theme) => theme.foundation.radius.xs,
        height: '100%',
        ...sx,
      }}
    >
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
