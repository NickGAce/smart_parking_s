import type { ReactNode } from 'react';
import { Stack } from '@mui/material';

import { ContentCard } from '../content-card';
import { EntityHeader } from '../entity-header';
import { PageContentLayout } from '../page-content-layout';

interface FormPageTemplateProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  headerActions?: ReactNode;
  helperText?: ReactNode;
  formSections: ReactNode;
  stickyActions?: ReactNode;
  topBanner?: ReactNode;
}

export function FormPageTemplate({
  title,
  subtitle,
  meta,
  headerActions,
  helperText,
  formSections,
  stickyActions,
  topBanner,
}: FormPageTemplateProps) {
  return (
    <PageContentLayout maxWidth={1100} spacing={2.5}>
      <EntityHeader title={title} subtitle={subtitle} meta={meta} actions={headerActions} />
      {topBanner}
      {helperText ? <ContentCard sx={{ p: { xs: 1.5, md: 2 } }}>{helperText}</ContentCard> : null}
      <Stack spacing={2.5}>{formSections}</Stack>
      {stickyActions ? (
        <ContentCard
          sx={{
            position: 'sticky',
            bottom: 12,
            zIndex: 5,
            boxShadow: (theme) => theme.foundation.shadows.md,
          }}
        >
          {stickyActions}
        </ContentCard>
      ) : null}
    </PageContentLayout>
  );
}
