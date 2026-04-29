import type { ReactNode } from 'react';
import { Stack } from '@mui/material';

import { ContentCard } from './content-card';

export function CompactFilterBar({ children }: { children: ReactNode }) {
  return (
    <ContentCard sx={{ p: 1.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.25} alignItems={{ md: 'center' }} flexWrap="wrap">
        {children}
      </Stack>
    </ContentCard>
  );
}
