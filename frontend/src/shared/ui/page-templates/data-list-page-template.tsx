import type { ReactNode } from 'react';
import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';

import { ContentCard } from '../content-card';
import { PageContentLayout } from '../page-content-layout';
import { PageState } from '../page-state';
import { ToolbarActions } from '../toolbar-actions';

interface DataListPageTemplateProps {
  title: ReactNode;
  subtitle?: ReactNode;
  headerMeta?: ReactNode;
  headerActions?: ReactNode;
  topBanner?: ReactNode;
  kpiStrip?: ReactNode;
  filters?: ReactNode;
  dataView?: ReactNode;
  isLoading?: boolean;
  errorText?: string;
  isEmpty?: boolean;
  emptyText?: string;
  stateSx?: SxProps<Theme>;
}

export function DataListPageTemplate({
  title,
  subtitle,
  headerMeta,
  headerActions,
  topBanner,
  kpiStrip,
  filters,
  dataView,
  isLoading,
  errorText,
  isEmpty,
  emptyText,
  stateSx,
}: DataListPageTemplateProps) {
  const hasState = Boolean(isLoading || errorText || isEmpty);

  return (
    <PageContentLayout maxWidth="100%" spacing={2.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-start' }} gap={1.5}>
        <Stack spacing={0.5}>
          {headerMeta ? <Typography variant="tableLabel" color="text.secondary">{headerMeta}</Typography> : null}
          <Typography variant="sectionTitle">{title}</Typography>
          {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
        </Stack>
        {headerActions ? <ToolbarActions>{headerActions}</ToolbarActions> : null}
      </Stack>
      {topBanner}
      {kpiStrip ? <Box>{kpiStrip}</Box> : null}
      {filters ? <Box>{filters}</Box> : null}
      {hasState ? (
        <Stack spacing={2}>
          <ContentCard sx={{ p: { xs: 3, md: 5 }, borderRadius: (theme) => theme.foundation.radius.xs, ...stateSx }}>
            <PageState isLoading={isLoading} errorText={errorText} isEmpty={isEmpty} emptyText={emptyText} />
          </ContentCard>
        </Stack>
      ) : (
        dataView
      )}
    </PageContentLayout>
  );
}
