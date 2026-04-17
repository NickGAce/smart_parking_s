import type { ReactNode } from 'react';
import { Box, Stack, type SxProps, type Theme } from '@mui/material';

interface PageContentLayoutProps {
  children: ReactNode;
  maxWidth?: number | string;
  withGutters?: boolean;
  spacing?: number;
  sx?: SxProps<Theme>;
}

export function PageContentLayout({ children, maxWidth = 1280, withGutters = true, spacing = 2, sx }: PageContentLayoutProps) {
  return (
    <Box sx={{ width: '100%', maxWidth, mx: 'auto', px: withGutters ? { xs: 0, sm: 0.5 } : 0, ...sx }}>
      <Stack spacing={spacing}>{children}</Stack>
    </Box>
  );
}
