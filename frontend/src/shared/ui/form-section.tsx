import type { ReactNode } from 'react';
import { Stack, type SxProps, type Theme } from '@mui/material';

import { ContentCard } from './content-card';
import { SectionHeader } from './section-header';

interface FormSectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export function FormSection({ title, subtitle, actions, children, sx }: FormSectionProps) {
  return (
    <ContentCard sx={sx}>
      {title ? <SectionHeader title={title} subtitle={subtitle} actions={actions} compact /> : null}
      <Stack spacing={2}>{children}</Stack>
    </ContentCard>
  );
}
