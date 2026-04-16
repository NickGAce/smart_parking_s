import { Button, Paper, Stack, type StackProps } from '@mui/material';
import type { ReactNode } from 'react';

interface FiltersToolbarProps {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  actions?: ReactNode;
  direction?: StackProps['direction'];
}

export function FiltersToolbar({
  children,
  onReset,
  resetLabel = 'Сбросить фильтры',
  actions,
  direction = { xs: 'column', md: 'row' },
}: FiltersToolbarProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction={direction} spacing={2} justifyContent="space-between">
        <Stack direction={direction} spacing={2} flexWrap="wrap">
          {children}
        </Stack>
        <Stack direction="row" spacing={1.5}>
          {onReset && (
            <Button variant="outlined" onClick={onReset}>
              {resetLabel}
            </Button>
          )}
          {actions}
        </Stack>
      </Stack>
    </Paper>
  );
}
