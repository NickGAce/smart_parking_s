import type { ReactNode } from 'react';
import { Stack } from '@mui/material';

import { ContentCard } from '../content-card';
import { EntityHeader } from '../entity-header';
import { StickyActionBar } from '../form-actions';
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
    <PageContentLayout maxWidth={1100} spacing={3}>
      <EntityHeader title={title} subtitle={subtitle} meta={meta} actions={headerActions} />
      {topBanner}
      {helperText ? <ContentCard sx={{ p: { xs: 2, md: 2.75 } }}>{helperText}</ContentCard> : null}
      <Stack spacing={3}>{formSections}</Stack>
      {stickyActions ? <StickyActionBar>{stickyActions}</StickyActionBar> : null}
    </PageContentLayout>
  );
}
