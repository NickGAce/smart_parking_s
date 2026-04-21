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
    <PageContentLayout maxWidth="100%" spacing={2.5}>
      <ContentCard
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: (theme) => theme.foundation.radius.sm,
          background: (theme) => `linear-gradient(120deg, ${theme.palette.background.paper} 0%, ${theme.palette.surface.overlay} 100%)`,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-start' }} gap={1.5}>
          <Stack spacing={0.5}>
            {meta ? <Typography variant="tableLabel" color="text.secondary">{meta}</Typography> : null}
            <Typography variant="sectionTitle">{title}</Typography>
            {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
          </Stack>
          {heroActions ? <ToolbarActions>{heroActions}</ToolbarActions> : null}
        </Stack>
        {heroExtra ? (
          <ContentCard sx={{ mt: 2.5, p: { xs: 2, md: 2.75 }, borderRadius: (theme) => theme.foundation.radius.sm }}>
            {heroExtra}
          </ContentCard>
        ) : null}
      </ContentCard>

      {kpis ? <Grid container spacing={2}>{kpis}</Grid> : null}

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          {analytics ? <ContentCard sx={{ borderRadius: (theme) => theme.foundation.radius.xs }}>{analytics}</ContentCard> : null}
        </Grid>
        <Grid item xs={12} lg={4}>
          {activity ? <ContentCard sx={{ borderRadius: (theme) => theme.foundation.radius.xs }}>{activity}</ContentCard> : null}
        </Grid>
      </Grid>
    </PageContentLayout>
  );
}
