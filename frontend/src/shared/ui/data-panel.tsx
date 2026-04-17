import type { ReactNode } from 'react';

import { ContentCard } from './content-card';
import { SectionHeader } from './section-header';

interface DataPanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function DataPanel({ title, subtitle, actions, children }: DataPanelProps) {
  return (
    <ContentCard>
      {title ? <SectionHeader title={title} subtitle={subtitle} actions={actions} /> : null}
      {children}
    </ContentCard>
  );
}
