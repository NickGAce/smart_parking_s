import type { ReactNode } from 'react';
import { Stack } from '@mui/material';
import { ContentCard } from './content-card';

export function DetailsPanel({ children }: { children: ReactNode }) {
  return <ContentCard sx={{ p: { xs: 2, md: 2.5 } }}><Stack spacing={1.5}>{children}</Stack></ContentCard>;
}
