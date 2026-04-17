import type { ReactNode } from 'react';
import { Stack } from '@mui/material';

interface ToolbarActionsProps {
  children: ReactNode;
  align?: 'start' | 'end';
}

export function ToolbarActions({ children, align = 'end' }: ToolbarActionsProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      justifyContent={align === 'end' ? 'flex-end' : 'flex-start'}
      alignItems="center"
    >
      {children}
    </Stack>
  );
}
