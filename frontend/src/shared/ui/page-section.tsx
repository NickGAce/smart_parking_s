import type { ReactNode } from 'react';

import { DataPanel } from './data-panel';

interface PageSectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageSection({ title, subtitle, actions, children }: PageSectionProps) {
  return (
    <DataPanel title={title} subtitle={subtitle} actions={actions}>
      {children}
    </DataPanel>
  );
}
