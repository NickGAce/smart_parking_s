import type { ReactNode } from 'react';
import { Stack, type SxProps, type Theme, Typography } from '@mui/material';

import { ContentCard } from './content-card';
import { SectionHeader } from './section-header';

interface FormSectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  helperText?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export function FormSection({ title, subtitle, helperText, actions, children, sx }: FormSectionProps) {
  return (
    <ContentCard sx={{ p: { xs: 1.5, md: 2 }, ...sx }}>
      {title ? <SectionHeader title={title} subtitle={subtitle} actions={actions} compact /> : null}
      <Stack spacing={2}>
        {helperText ? <Typography variant="body2" color="text.secondary">{helperText}</Typography> : null}
        {children}
      </Stack>
    </ContentCard>
  );
}
