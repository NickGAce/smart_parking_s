import type { ReactNode } from 'react';
import { Paper, type SxProps, type Theme } from '@mui/material';

interface ContentCardProps {
  children: ReactNode;
  padded?: boolean;
  sx?: SxProps<Theme>;
}

export function ContentCard({ children, padded = true, sx }: ContentCardProps) {
  return (
    <Paper
      sx={{
        borderRadius: (theme) => theme.foundation.radius.sm,
        border: 1,
        borderColor: 'border.subtle',
        p: padded ? { xs: 2.5, md: 3.5 } : 0,
        boxShadow: (theme) => theme.foundation.shadows.xs,
        width: '100%',
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
