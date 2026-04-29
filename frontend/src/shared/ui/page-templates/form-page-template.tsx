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
  maxWidth?: number | string;
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
  maxWidth = 1200,
  headerActions,
  helperText,
  formSections,
  stickyActions,
  topBanner,
}: FormPageTemplateProps) {
  return (
    <PageContentLayout maxWidth={maxWidth} spacing={2.5}>
      <EntityHeader title={title} subtitle={subtitle} meta={meta} actions={headerActions} />
      {topBanner}
      {helperText ? <ContentCard sx={{ p: { xs: 2, md: 2.75 } }}>{helperText}</ContentCard> : null}
      <Stack spacing={2.5}>{formSections}</Stack>
      {stickyActions ? <StickyActionBar>{stickyActions}</StickyActionBar> : null}
    </PageContentLayout>
  );
}
