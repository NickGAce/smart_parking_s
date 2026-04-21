import type { ReactNode } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

import { ContentCard } from './content-card';
import { SectionHeader } from './section-header';

interface DataPanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export function DataPanel({ title, subtitle, actions, children, sx }: DataPanelProps) {
  return (
    <ContentCard sx={sx}>
      {title ? <SectionHeader title={title} subtitle={subtitle} actions={actions} /> : null}
      {children}
    </ContentCard>
  );
}
