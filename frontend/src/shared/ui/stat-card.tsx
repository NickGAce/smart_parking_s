import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

import { ContentCard } from './content-card';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <ContentCard sx={{ p: 2.25, height: '100%' }}>
      <Stack spacing={0.75}>
        <Typography variant="tableLabel" color="text.secondary">{label}</Typography>
        <Typography variant="h5">{value}</Typography>
        {hint ? <Typography variant="body2" color="text.secondary">{hint}</Typography> : null}
      </Stack>
    </ContentCard>
  );
}
