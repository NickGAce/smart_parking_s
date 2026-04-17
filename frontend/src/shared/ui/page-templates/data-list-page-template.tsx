import type { ReactNode } from 'react';
import { Box, Stack, type SxProps, type Theme } from '@mui/material';

import { ContentCard } from '../content-card';
import { EntityHeader } from '../entity-header';
import { PageContentLayout } from '../page-content-layout';
import { PageState } from '../page-state';

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
  const stateNode = <PageState isLoading={isLoading} errorText={errorText} isEmpty={isEmpty} emptyText={emptyText} />;

  return (
    <PageContentLayout maxWidth={1280} spacing={2.5}>
      <EntityHeader title={title} subtitle={subtitle} meta={headerMeta} actions={headerActions} />
      {topBanner}
      {kpiStrip ? <Box>{kpiStrip}</Box> : null}
      {filters ? <Box>{filters}</Box> : null}
      {stateNode ? (
        <Stack spacing={2}>
          {!isLoading && !errorText && !isEmpty ? dataView : null}
          {(isLoading || errorText || isEmpty) && (
            <ContentCard sx={{ p: { xs: 3, md: 5 }, ...stateSx }}>{stateNode}</ContentCard>
          )}
        </Stack>
      ) : (
        dataView
      )}
    </PageContentLayout>
  );
}
