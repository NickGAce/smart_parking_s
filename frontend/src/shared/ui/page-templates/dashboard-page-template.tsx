import type { ReactNode } from 'react';
import { Grid, Stack, Typography } from '@mui/material';

import { ContentCard } from '../content-card';
import { PageContentLayout } from '../page-content-layout';
import { ToolbarActions } from '../toolbar-actions';

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
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-start' }} gap={1.5}>
        <Stack spacing={0.5}>
          {meta ? <Typography variant="tableLabel" color="text.secondary">{meta}</Typography> : null}
          <Typography variant="sectionTitle">{title}</Typography>
          {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
        </Stack>
        {heroActions ? <ToolbarActions>{heroActions}</ToolbarActions> : null}
      </Stack>
      {heroExtra ? <ContentCard sx={{ p: { xs: 1.5, md: 2 } }}>{heroExtra}</ContentCard> : null}

      {kpis ? <Grid container spacing={2}>{kpis}</Grid> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          {analytics ? <ContentCard>{analytics}</ContentCard> : null}
        </Grid>
        <Grid item xs={12} lg={4}>
          {activity ? <ContentCard>{activity}</ContentCard> : null}
        </Grid>
      </Grid>
    </PageContentLayout>
  );
}
