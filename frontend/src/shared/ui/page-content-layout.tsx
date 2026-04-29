import type { ReactNode } from 'react';
import { type SxProps, type Theme } from '@mui/material';

import { PageShell } from './page-shell';

interface PageContentLayoutProps {
  children: ReactNode;
  maxWidth?: number | string;
  withGutters?: boolean;
  spacing?: number;
  sx?: SxProps<Theme>;
}

export function PageContentLayout({ children, maxWidth = 1280, withGutters = true, spacing = 2.5, sx }: PageContentLayoutProps) {
  return <PageShell maxWidth={maxWidth} spacing={spacing} sx={{ px: withGutters ? { xs: 0, sm: 0.5, lg: 1 } : 0, ...sx }}>{children}</PageShell>;
}
