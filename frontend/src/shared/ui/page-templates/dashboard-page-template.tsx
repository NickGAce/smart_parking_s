import type { ReactNode } from 'react';
import { Grid, Stack } from '@mui/material';

import { ContentCard } from '../content-card';
import { EntityHeader } from '../entity-header';
import { PageContentLayout } from '../page-content-layout';

interface DashboardPageTemplateProps {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  heroActions?: ReactNode;
  heroExtra?: ReactNode;
  kpis?: ReactNode;
  analytics?: ReactNode;
  activity?: ReactNode;
}

export function DashboardPageTemplate({
  title,
  subtitle,
  meta,
  heroActions,
  heroExtra,
  kpis,
  analytics,
  activity,
}: DashboardPageTemplateProps) {
  return (
    <PageContentLayout maxWidth={1280} spacing={2.5}>
      <ContentCard>
        <Stack spacing={2}>
          <EntityHeader title={title} subtitle={subtitle} meta={meta} actions={heroActions} />
          {heroExtra}
        </Stack>
      </ContentCard>

      {kpis ? <Grid container spacing={2}>{kpis}</Grid> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <ContentCard>{analytics}</ContentCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <ContentCard>{activity}</ContentCard>
        </Grid>
      </Grid>
    </PageContentLayout>
  );
}
