import type { ReactNode } from 'react';
import { Box, Stack, type SxProps, type Theme } from '@mui/material';

interface PageShellProps {
  children: ReactNode;
  maxWidth?: number | string;
  spacing?: number;
  sx?: SxProps<Theme>;
}

export function PageShell({ children, maxWidth = 1280, spacing = 2.5, sx }: PageShellProps) {
  return (
    <Box sx={{ width: '100%', maxWidth, mx: 'auto', px: { xs: 0, sm: 0.5, lg: 1 }, ...sx }}>
      <Stack spacing={spacing}>{children}</Stack>
    </Box>
  );
}
