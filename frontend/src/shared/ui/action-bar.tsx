import type { ReactNode } from 'react';
import { Stack, type SxProps, type Theme } from '@mui/material';

import { ContentCard } from './content-card';
import { ToolbarActions } from './toolbar-actions';

interface ActionBarProps {
  children?: ReactNode;
  actions?: ReactNode;
  sx?: SxProps<Theme>;
}

export function ActionBar({ children, actions, sx }: ActionBarProps) {
  return (
    <ContentCard sx={{ p: { xs: 2, md: 2.75 }, ...sx }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          {children}
        </Stack>
        {actions ? <ToolbarActions>{actions}</ToolbarActions> : null}
      </Stack>
    </ContentCard>
  );
}
