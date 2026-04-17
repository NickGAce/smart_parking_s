import type { ReactNode } from 'react';
import { Grid, Stack } from '@mui/material';

import { ContentCard } from '../content-card';
import { EntityHeader } from '../entity-header';
import { PageContentLayout } from '../page-content-layout';

interface DetailsPageTemplateProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  primaryActions?: ReactNode;
  secondaryActions?: ReactNode;
  summaryCards?: ReactNode;
  relatedSections: ReactNode;
  topBanner?: ReactNode;
}

export function DetailsPageTemplate({
  title,
  subtitle,
  meta,
  primaryActions,
  secondaryActions,
  summaryCards,
  relatedSections,
  topBanner,
}: DetailsPageTemplateProps) {
  return (
    <PageContentLayout maxWidth={1280} spacing={2.5}>
      <EntityHeader title={title} subtitle={subtitle} meta={meta} actions={primaryActions} />
      {topBanner}
      {summaryCards ? (
        <ContentCard sx={{ p: { xs: 2, md: 2.5 } }}>
          <Grid container spacing={1.5}>{summaryCards}</Grid>
        </ContentCard>
      ) : null}
      <Stack spacing={2}>{relatedSections}</Stack>
      {secondaryActions ? <ContentCard sx={{ p: { xs: 1.5, md: 2 } }}>{secondaryActions}</ContentCard> : null}
    </PageContentLayout>
  );
}
