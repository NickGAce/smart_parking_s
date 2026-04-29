import type { ReactNode } from 'react';
import { Grid, type GridProps } from '@mui/material';

interface ContentGridProps extends Omit<GridProps, 'container'> {
  children: ReactNode;
  spacing?: number;
}

export function ContentGrid({ children, spacing = 2, ...rest }: ContentGridProps) {
  return (
    <Grid container spacing={spacing} alignItems="stretch" {...rest}>
      {children}
    </Grid>
  );
}
