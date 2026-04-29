import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

import { ContentCard } from './content-card';

interface InfoCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function InfoCard({ title, description, actions, children }: InfoCardProps) {
  return (
    <ContentCard sx={{ p: { xs: 2, md: 2.5 }, height: '100%' }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography variant="h6">{title}</Typography>
          {description ? <Typography color="text.secondary">{description}</Typography> : null}
        </Stack>
        {children}
        {actions}
      </Stack>
    </ContentCard>
  );
}
